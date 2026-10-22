# OMEGA OPERADOR V5 — local, allowlisted tasks. No remote bridge writes.
import argparse
import csv
import datetime as dt
import json
import os
import re
import subprocess
import sys
import textwrap
import unicodedata
import urllib.parse
import uuid
import webbrowser
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

APP_ROOT = Path(__file__).resolve().parent
HOME = Path.home()
DOCS = HOME / 'Documents' / 'OMEGA-Documentos'
LOGS = APP_ROOT / 'diagnosticos'
HISTORY = APP_ROOT / 'historial-local.jsonl'
ROOT_V4 = APP_ROOT.parent / 'omega-operator-v4'
RATE = 16000


def norm(text):
    text = unicodedata.normalize('NFKD', text.lower())
    text = ''.join(c for c in text if not unicodedata.combining(c))
    text = text.replace('power shell', 'powershell').replace('power point', 'powerpoint')
    text = re.sub(r'[^\w\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def strip_wake(text):
    p = norm(text)
    p = re.sub(r'^(?:(?:hola|ola|oye|buenas|buenos dias|por la)\s+)?omega\s+', '', p, count=1)
    return re.sub(r'^(?:por favor\s+)', '', p)


def slug(text):
    p = norm(text)
    p = re.sub(r'[^a-z0-9]+', '-', p).strip('-')
    return (p[:55].strip('-') or 'documento')


def dest_folder(name):
    aliases = {
        'descargas': HOME / 'Downloads', 'downloads': HOME / 'Downloads',
        'escritorio': HOME / 'Desktop', 'desktop': HOME / 'Desktop',
        'documentos': HOME / 'Documents', 'mis documentos': HOME / 'Documents',
        'documentos omega': DOCS, 'carpeta omega': DOCS,
    }
    return aliases.get(name)


def classify(raw):
    p = strip_wake(raw)
    # Disallow multi-command injection except explicitly supported, fully matched composites.
    m = re.fullmatch(r'(?:abre|abrir|inicia|ejecuta|puedes abrir|quiero que abras)\s+(?:(?:la|el|un|una)\s+)?calculadora\s+y\s+(?:(?:calcula|multiplica|suma|resta|divide)\s+)(.+)', p)
    if m:
        return ('calc_open', m.group(1))
    m = re.fullmatch(r'(?:calcula|cuanto es|multiplica|suma|resta|divide)\s+(.+)', p)
    if m:
        return ('calc', m.group(1))
    # Typical misheard phrase from actual user speech, but only if whole phrase is safe.
    if re.fullmatch(r'(?:abre|abrir|puedes abrir)\s+(?:(?:el|la)\s+)?explorador(?: de archivos)?\s+(?:y\s+)?(?:entra|entro|ve|ir|abre)\s+(?:en|a|la|las)?\s*descargas', p):
        return ('folder', 'descargas')
    m = re.fullmatch(r'(?:abre|abrir|entra|ve|ir|muestra|puedes abrir)\s+(?:(?:el|la|las|mis|carpeta de|carpeta)\s+)?(descargas|downloads|escritorio|desktop|documentos|mis documentos|documentos omega|carpeta omega)', p)
    if m:
        return ('folder', m.group(1))
    m = re.fullmatch(r'(?:abre|abrir|inicia|ejecuta|puedes abrir|quiero que abras)\s+(?:(?:el|la|un|una)\s+)?(internet|navegador|browser|google|chrome|edge|calculadora|calculator|bloc de notas|blog de notas|bloc|notepad|explorador|explorador de archivos|paint|word|excel|powerpoint|cmd|simbolo del sistema|terminal|powershell|power shell|ajustes|configuracion)(?:\s+por favor)?', p)
    if m:
        return ('app', m.group(1))
    m = re.fullmatch(r'(?:busca|buscar|investiga)\s+(?:(?:en|por)\s+)?(?:internet|google|la web)\s+(.{2,160})', p)
    if m:
        return ('search', m.group(1))
    m = re.fullmatch(r'(?:busca|buscar)\s+(.{2,160})\s+(?:en internet|en google)', p)
    if m:
        return ('search', m.group(1))
    # New empty note, optionally with a subject, without inventing deep research.
    m = re.fullmatch(r'(?:abre|abrir|crea|crear)\s+(?:(?:un|el)\s+)?(?:bloc|blog)(?: de notas)?\s+(?:limpio|nuevo|vacio)(?:\s+y\s+(?:habla|escribe|pon texto|redacta)\s+sobre\s+(.{2,90}))?', p)
    if m:
        return ('note', m.group(1) or '')
    m = re.fullmatch(r'(?:crea|crear|redacta|escribe|prepara|haz)\s+(?:(?:un|una|el|la)\s+)?(?:informe|documento|archivo|nota|pdf|word|documento word|documento pdf|archivo pdf|excel|hoja de calculo|markdown|texto)(?:\s+(?:nuevo|nueva))?\s+(?:sobre|acerca de|de)\s+(.{2,100})', p)
    if m:
        prefix = p[:m.start(1)]
        kind = ('pdf' if 'pdf' in prefix else 'xlsx' if ('excel' in prefix or 'hoja de calculo' in prefix) else 'md' if 'markdown' in prefix else 'txt' if ('nota' in prefix or 'texto' in prefix) else 'docx')
        return ('create', (kind, m.group(1)))
    m = re.fullmatch(r'(?:crea|crear|prepara)\s+(?:(?:un|una)\s+)?(pdf|documento pdf|archivo pdf|word|documento word|excel|hoja de calculo|nota|markdown|texto)(?:\s+(?:nuevo|nueva))?', p)
    if m:
        s = m.group(1)
        return ('create', ('pdf' if 'pdf' in s else 'xlsx' if ('excel' in s or 'hoja' in s) else 'md' if s == 'markdown' else 'txt' if s in ('nota','texto') else 'docx', 'nuevo documento'))
    m = re.fullmatch(r'(?:escribe|apunta|anota)\s+(.{2,1000})', p)
    if m:
        # Literal text comes from raw speech after the leading verb, not normalized.
        raw_body = re.sub(r'^\s*(?:(?:hola|ola|oye)\s+)?omega[,.:! ]*', '', raw, flags=re.I)
        raw_body = re.sub(r'^\s*(?:escribe|apunta|anota)\s+', '', raw_body, flags=re.I).strip()
        return ('write', raw_body)
    m = re.fullmatch(r'(?:convierte|convertir|pasa|exporta)\s+(?:(?:el|mi)\s+)?(?:ultimo|ultima)\s+(?:documento|archivo|nota|word|texto|docx)\s+(?:a|en)\s+pdf', p)
    if m:
        return ('to_pdf', None)
    if re.fullmatch(r'(?:une|unir|combina|combinar|fusiona)\s+(?:(?:los|las)\s+)?(?:dos|2)\s+(?:ultimos|ultimas)\s+pdf', p):
        return ('pdf_merge', None)
    if re.fullmatch(r'(?:extrae|extraer|saca|lee|leer)\s+(?:(?:el|la)\s+)?texto\s+(?:del|de la)\s+(?:ultimo|ultima)\s+pdf', p) or re.fullmatch(r'(?:convierte|convertir)\s+(?:(?:el|la)\s+)?(?:ultimo|ultima)\s+pdf\s+a\s+texto', p):
        return ('pdf_extract', None)
    if re.fullmatch(r'(?:cuantas paginas tiene|numero de paginas del|muestra paginas del)\s+(?:(?:el|la)\s+)?(?:ultimo|ultima)\s+pdf', p):
        return ('pdf_pages', None)
    m = re.fullmatch(r'(?:abre|abrir|muestra|lee|leer)\s+(?:(?:el|la)\s+)?(?:ultimo|ultima)\s+(pdf|documento|word|archivo|nota|excel)', p)
    if m:
        return ('latest', m.group(1))
    m = re.fullmatch(r'(?:lista|listar|muestra|mostrar|cuantos hay|que hay en)\s+(?:(?:los|mis|las|la|el|archivos de|archivos en|carpeta de|carpeta)\s+)?(descargas|documentos|escritorio|documentos omega|carpeta omega)', p)
    if m:
        return ('list', m.group(1))
    m = re.fullmatch(r'(?:crea|crear|haz)\s+(?:(?:una|la)\s+)?carpeta\s+(?:llamada|de nombre)?\s*(.{2,60})', p)
    if m:
        return ('newfolder', m.group(1))
    # Fixed read-only diagnostics; never accept arbitrary shell strings.
    diagnostics = [
        (r'(?:muestra|ver|enseña|ensena|lista|listar|dime)\s+(?:los\s+)?procesos(?: de windows)?', 'procesos'),
        (r'(?:muestra|ver|lista|listar|dime)\s+(?:los\s+)?servicios(?: de windows)?', 'servicios'),
        (r'(?:muestra|ver|dime|revisa)\s+(?:la\s+)?(?:red|configuracion de red|ip|direccion ip)', 'red'),
        (r'(?:muestra|ver|dime|revisa)\s+(?:los\s+)?(?:discos|unidades|espacio en disco)', 'discos'),
        (r'(?:muestra|ver|dime|revisa)\s+(?:el\s+)?(?:sistema|estado del sistema|informacion del equipo|equipo|windows)', 'sistema'),
        (r'(?:muestra|ver|dime)\s+(?:la\s+)?(?:fecha|hora|fecha y hora)', 'fecha'),
        (r'(?:ejecuta|lanza|muestra|haz)\s+(?:el\s+)?(?:cmd\s+)?(?:comando\s+)?ipconfig(?:\s+all)?', 'red'),
        (r'(?:ejecuta|lanza|muestra|haz)\s+(?:el\s+)?(?:cmd\s+)?(?:comando\s+)?whoami', 'usuario'),
        (r'(?:ejecuta|lanza|muestra|haz)\s+(?:el\s+)?(?:cmd\s+)?(?:comando\s+)?hostname', 'equipo'),
        (r'(?:ejecuta|lanza|muestra|haz)\s+(?:el\s+)?(?:powershell\s+)?(?:comando\s+)?get process', 'procesos'),
        (r'(?:ejecuta|lanza|muestra|haz)\s+(?:el\s+)?(?:powershell\s+)?(?:comando\s+)?get service', 'servicios'),
        (r'(?:ejecuta|lanza|muestra|haz)\s+(?:el\s+)?(?:powershell\s+)?(?:comando\s+)?get date', 'fecha'),
    ]
    for pat, key in diagnostics:
        if re.fullmatch(pat, p):
            return ('diagnostic', key)
    return None


WORDS = {'cero':0,'uno':1,'una':1,'dos':2,'tres':3,'cuatro':4,'cinco':5,'seis':6,'siete':7,'ocho':8,'nueve':9,'diez':10,'once':11,'doce':12,'trece':13,'catorce':14,'quince':15,'dieciseis':16,'diecisiete':17,'dieciocho':18,'diecinueve':19,'veinte':20,'treinta':30,'cuarenta':40,'cincuenta':50,'sesenta':60,'setenta':70,'ochenta':80,'noventa':90,'cien':100}

def number(value):
    v = value.strip().replace(',', '.')
    if v in WORDS:
        return float(WORDS[v])
    if v.startswith('menos '):
        return -number(v[6:])
    parts = v.split(' y ')
    if len(parts)==2 and parts[0] in WORDS and parts[1] in WORDS:
        return float(WORDS[parts[0]]+WORDS[parts[1]])
    if not re.fullmatch(r'-?\d{1,9}(?:\.\d{1,6})?',v):
        raise ValueError('Numero no reconocido')
    return float(v)

def calculate(expr):
    p=norm(expr)
    pats=[
        (r'(?:multiplica\s+)?(.+?)\s+(?:por|multiplicado por)\s+(.+)', '*'),
        (r'(?:suma\s+)?(.+?)\s+(?:mas|y)\s+(.+)', '+'),
        (r'(?:resta\s+)?(.+?)\s+menos\s+(.+)', '-'),
        (r'(?:divide\s+)?(.+?)\s+(?:entre|dividido por)\s+(.+)', '/'),
    ]
    for pat,op in pats:
        m=re.fullmatch(pat,p)
        if m:
            a,b=number(m.group(1)),number(m.group(2))
            if op=='/' and b==0: raise ValueError('Division por cero')
            ans={'*':lambda:a*b,'+':lambda:a+b,'-':lambda:a-b,'/':lambda:a/b}[op]()
            return f'{a:g} {op} {b:g} = {ans:g}'
    m=re.fullmatch(r'(?:el\s+)?(\d+(?:\.\d+)?)\s*(?:por|x|\*)\s*(\d+(?:\.\d+)?)',p)
    if m:
        a,b=float(m.group(1)),float(m.group(2))
        return f'{a:g} * {b:g} = {a*b:g}'
    raise ValueError('Operacion no reconocida; prueba: multiplica cuatro por cuatro')


def draft(topic):
    return [f'Borrador: {topic.capitalize()}', '',
            f'Tema: {topic}.',
            'Tipo: borrador inicial sin investigacion ni fuentes externas.', '',
            '1. Objetivo',
            f'Organizar la informacion y las preguntas principales relacionadas con {topic}.', '',
            '2. Puntos a desarrollar',
            '- Definiciones y conceptos basicos.',
            '- Aplicaciones y ejemplos practicos.',
            '- Ventajas, limitaciones y requisitos.',
            '- Fuentes que conviene contrastar antes de publicar.', '',
            '3. Proximos pasos',
            'Investigar fuentes fiables, contrastar afirmaciones y redactar una version definitiva.', '',
            'Generado localmente por OMEGA OPERADOR 5.0.']


def unique_path(ext,topic):
    DOCS.mkdir(parents=True,exist_ok=True)
    stamp=dt.datetime.now().strftime('%Y%m%d-%H%M%S')
    return DOCS / f'OMEGA-{stamp}-{slug(topic)}-{uuid.uuid4().hex[:5]}.{ext}'


def write_docx(path,lines):
    paragraphs=''.join('<w:p><w:r><w:t xml:space="preserve">'+escape(s)+'</w:t></w:r></w:p>' for s in lines)
    document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+paragraphs+'<w:sectPr/></w:body></w:document>'
    content_types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
    rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml',content_types)
        z.writestr('_rels/.rels',rels)
        z.writestr('word/document.xml',document)


def write_xlsx(path, topic):
    rows=[['Concepto','Descripcion','Importe'],['Tema',topic,''],['Elemento 1','Pendiente de definir',0],['Elemento 2','Pendiente de definir',0],['Total estimado','Sin datos reales',0]]
    cells=[]
    for ri,row in enumerate(rows,1):
        row_cells=[]
        for ci,val in enumerate(row):
            name=chr(65+ci)+str(ri)
            if isinstance(val,(float,int)):
                row_cells.append(f'<c r="{name}"><v>{val}</v></c>')
            else:
                row_cells.append(f'<c r="{name}" t="inlineStr"><is><t>{escape(str(val))}</t></is></c>')
        cells.append(f'<row r="{ri}">'+''.join(row_cells)+'</row>')
    sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(cells)+'</sheetData></worksheet>'
    types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'
    rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'
    workbook='<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Hoja1" sheetId="1" r:id="rId1"/></sheets></workbook>'
    wb_rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'
    with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml',types)
        z.writestr('_rels/.rels',rels)
        z.writestr('xl/workbook.xml',workbook)
        z.writestr('xl/_rels/workbook.xml.rels',wb_rels)
        z.writestr('xl/worksheets/sheet1.xml',sheet)


def write_pdf(path,lines):
    # Minimal valid multi-page PDF, text-only, WinAnsiEncoding; no extra packages.
    wrapped=[]
    for s in lines:
        wrapped += textwrap.wrap(s,width=87,break_long_words=False,replace_whitespace=False) or ['']
    pages=[wrapped[i:i+49] for i in range(0,len(wrapped),49)] or [['']]
    objects=[]
    def add(obj):
        objects.append(obj.encode('latin-1','replace') if isinstance(obj,str) else obj)
        return len(objects)
    catalog=add('')
    pagesobj=add('')
    font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    ids=[]
    for pg in pages:
        cmds=['BT /F1 11 Tf 50 790 Td 15 TL']
        for line in pg:
            raw=line.encode('cp1252','replace')
            safe=raw.replace(b'\\',b'\\\\').replace(b'(',b'\\(').replace(b')',b'\\)')
            cmds.append('('+safe.decode('latin-1')+') Tj T*')
        cmds.append('ET')
        content='\n'.join(cmds).encode('latin-1')
        stream=add(f'<< /Length {len(content)} >>\nstream\n'.encode()+content+b'\nendstream')
        pid=add(f'<< /Type /Page /Parent {pagesobj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font} 0 R >> >> /Contents {stream} 0 R >>')
        ids.append(pid)
    objects[catalog-1]=f'<< /Type /Catalog /Pages {pagesobj} 0 R >>'.encode()
    objects[pagesobj-1]=f'<< /Type /Pages /Kids [ '+ ' '.join(f'{i} 0 R' for i in ids) + f' ] /Count {len(ids)} >>'
    objects[pagesobj-1]=objects[pagesobj-1].encode()
    output=bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')
    offsets=[0]
    for i,obj in enumerate(objects,1):
        offsets.append(len(output))
        output+=f'{i} 0 obj\n'.encode()+obj+b'\nendobj\n'
    xref=len(output)
    output+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
    for off in offsets[1:]:
        output+=f'{off:010d} 00000 n \n'.encode()
    output+=f'trailer\n<< /Size {len(objects)+1} /Root {catalog} 0 R >>\nstartxref\n{xref}\n%%EOF'.encode()
    path.write_bytes(output)


def extract_docx(path):
    with zipfile.ZipFile(path) as z:
        root=ET.fromstring(z.read('word/document.xml'))
    ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    return [''.join(x.text or '' for x in p.findall('.//w:t',ns)) for p in root.findall('.//w:p',ns)]


def write_document(kind,topic,lines=None):
    lines=lines or draft(topic)
    ext={'docx':'docx','pdf':'pdf','md':'md','txt':'txt','xlsx':'xlsx'}[kind]
    path=unique_path(ext,topic)
    if kind=='pdf': write_pdf(path,lines)
    elif kind=='docx': write_docx(path,lines)
    elif kind=='xlsx': write_xlsx(path,topic)
    else: path.write_text('\n'.join(lines),encoding='utf-8')
    if not path.is_file() or path.stat().st_size<20:
        raise RuntimeError('Archivo no verificado')
    print('CREADO Y VERIFICADO:',path,flush=True)
    return path


def find_latest(kind=None):
    DOCS.mkdir(parents=True,exist_ok=True)
    pattern={'pdf':'*.pdf','word':'*.docx','nota':'*.txt','excel':'*.xlsx'}.get(kind,'*')
    candidates=[f for f in DOCS.glob(pattern) if f.is_file()]
    return max(candidates,key=lambda f:f.stat().st_mtime) if candidates else None


def open_file(path):
    # Associations can be missing: always offer a usable fallback.
    try:
        os.startfile(str(path))
        print('ABIERTO:',path)
        return True
    except (OSError,AttributeError) as exc:
        print('Sin asociacion directa para',path.suffix,':',exc)
        if path.suffix.lower()=='.pdf':
            try:
                webbrowser.open_new_tab(path.resolve().as_uri())
                print('Intentando abrir PDF en navegador predeterminado')
                return True
            except Exception: pass
        if path.suffix.lower() in ('.docx','.xlsx'):
            lines=extract_docx(path) if path.suffix.lower()=='.docx' else ['OMEGA: hoja de calculo sin visor compatible.','Instala o abre una aplicacion de hojas de calculo para visualizar el XLSX.']
            txt=path.with_suffix('.txt')
            txt.write_text('\n'.join(lines),encoding='utf-8')
            subprocess.Popen(['notepad.exe',str(txt)])
            print('Abierta version alternativa TXT en Bloc de notas:',txt)
            return True
        try:
            subprocess.Popen(['notepad.exe',str(path)])
            return True
        except Exception:
            return False


def open_app(name):
    if name in ('calculadora','calculator'): cmd=['calc.exe']
    elif name in ('bloc de notas','blog de notas','bloc','notepad'): cmd=['notepad.exe']
    elif name in ('explorador','explorador de archivos'): cmd=['explorer.exe']
    elif name=='paint': cmd=['mspaint.exe']
    elif name in ('cmd','simbolo del sistema','terminal'): cmd=['cmd.exe']
    elif name in ('powershell','power shell'): cmd=['powershell.exe','-NoProfile']
    elif name in ('ajustes','configuracion'):
        os.startfile('ms-settings:')
        print('Ajustes abiertos'); return
    elif name in ('internet','navegador','browser','google','chrome','edge'):
        webbrowser.open_new_tab('https://www.google.com/')
        print('Navegador solicitado'); return
    elif name in ('word','excel','powerpoint'):
        exe={'word':'winword.exe','excel':'excel.exe','powerpoint':'powerpnt.exe'}[name]
        try:
            subprocess.Popen([exe]); print('Solicitada apertura de',name); return
        except OSError:
            print(f'{name} no se ha encontrado instalado o en PATH. Crea documentos con: crea un documento sobre hologramas')
            return
    else: raise ValueError('Aplicacion no autorizada')
    subprocess.Popen(cmd)
    print('Solicitada apertura:',name)


DIAGNOSTICS={
    'procesos': ['powershell.exe','-NoProfile','-NonInteractive','-Command','Get-Process | Sort-Object CPU -Descending | Select-Object -First 15 Name,Id,CPU | Format-Table -AutoSize'],
    'servicios':['powershell.exe','-NoProfile','-NonInteractive','-Command','Get-Service | Select-Object -First 25 Name,Status | Format-Table -AutoSize'],
    'red':['ipconfig.exe','/all'],
    'discos':['powershell.exe','-NoProfile','-NonInteractive','-Command','Get-PSDrive -PSProvider FileSystem | Select-Object Name,Used,Free | Format-Table -AutoSize'],
    'sistema':['powershell.exe','-NoProfile','-NonInteractive','-Command','Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,OSArchitecture | Format-List'],
    'fecha':['powershell.exe','-NoProfile','-NonInteractive','-Command','Get-Date | Format-List'],
    'usuario':['whoami.exe'],
    'equipo':['hostname.exe'],
}


def diagnostic(key):
    cmd=DIAGNOSTICS.get(key)
    if cmd is None: raise ValueError('Diagnostico no autorizado')
    print('Diagnostico de solo lectura:',key)
    out=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,errors='replace',timeout=40)
    data=out.stdout[:20000]
    print(data)
    LOGS.mkdir(parents=True,exist_ok=True)
    logfile=LOGS/f'omega-{key}-{dt.datetime.now().strftime("%Y%m%d-%H%M%S")}.txt'
    logfile.write_text(data,encoding='utf-8')
    print('REGISTRO LOCAL:',logfile)
    if out.returncode: print('Aviso: comando termino con codigo',out.returncode)


def execute(task):
    kind,arg=task
    if kind=='app':open_app(arg)
    elif kind=='folder':
        folder=dest_folder(arg)
        if folder is None: raise ValueError('Carpeta no permitida')
        if folder==DOCS:folder.mkdir(parents=True,exist_ok=True)
        os.startfile(str(folder))
        print('Carpeta abierta:',folder)
    elif kind=='search':
        url='https://www.google.com/search?q='+urllib.parse.quote(arg)
        webbrowser.open_new_tab(url)
        print('Busqueda abierta en navegador:',arg)
    elif kind in ('calc','calc_open'):
        if kind=='calc_open': open_app('calculadora')
        result=calculate(arg)
        print('RESULTADO:',result)
        # If the user prefixed their phrase with opens calculator, this is still computed locally.
    elif kind=='create':
        fmt,topic=arg
        path=write_document(fmt,topic)
        open_file(path)
    elif kind=='note':
        topic=arg
        if topic:
            path=write_document('txt',topic)
            open_file(path)
        else:open_app('notepad')
    elif kind=='write':
        path=write_document('txt','dictado',[arg])
        open_file(path)
    elif kind=='to_pdf':
        latest=find_latest()
        if not latest or latest.suffix.lower() not in ('.txt','.md','.docx'):
            candidates=[f for f in DOCS.glob('*') if f.suffix.lower() in ('.txt','.md','.docx')]
            latest=max(candidates,key=lambda x:x.stat().st_mtime) if candidates else None
        if not latest: raise FileNotFoundError('No hay documento OMEGA compatible para convertir')
        lines=extract_docx(latest) if latest.suffix.lower()=='.docx' else latest.read_text(encoding='utf-8',errors='replace').splitlines()
        target=write_document('pdf',latest.stem,lines)
        open_file(target)
    elif kind in ('pdf_merge','pdf_extract','pdf_pages'):
        try:
            from pypdf import PdfReader, PdfWriter
        except ImportError:
            raise RuntimeError('No se encontro pypdf; ejecuta el instalador de OMEGA V5 otra vez cuando haya conexion')
        files=sorted([x for x in DOCS.glob('*.pdf') if x.is_file()],key=lambda x:x.stat().st_mtime,reverse=True)
        if not files: raise FileNotFoundError('Aun no hay PDFs en OMEGA-Documentos')
        if kind=='pdf_pages':
            print('PAGINAS:',len(PdfReader(files[0]).pages),'EN:',files[0]);return
        if kind=='pdf_extract':
            pdf=PdfReader(files[0])
            body='\n'.join(page.extract_text() or '' for page in pdf.pages)
            target=write_document('txt','texto-extraido-pdf',body.splitlines() or ['Sin texto extraible'])
            open_file(target);return
        if len(files)<2: raise FileNotFoundError('Se necesitan al menos dos PDFs de OMEGA')
        writer=PdfWriter()
        for path in reversed(files[:2]):writer.append(str(path))
        target=unique_path('pdf','pdf-unidos')
        with target.open('wb') as stream:writer.write(stream)
        if not target.is_file() or target.stat().st_size<100:raise RuntimeError('No se verifico la union')
        print('PDFs UNIDOS:',target)
        open_file(target)
    elif kind=='latest':
        p=find_latest(arg)
        if p:open_file(p)
        else:print('No hay archivos OMEGA de ese tipo')
    elif kind=='list':
        folder=dest_folder(arg)
        if not folder: raise ValueError('Carpeta no autorizada')
        if not folder.exists():print('La carpeta no existe:',folder);return
        items=sorted(folder.iterdir(),key=lambda x:x.stat().st_mtime,reverse=True)[:30]
        print('CONTENIDO',folder)
        for p in items:print(' [DIR]' if p.is_dir() else ' [FILE]',p.name)
    elif kind=='newfolder':
        name=slug(arg)
        path=DOCS/name
        path.mkdir(parents=True,exist_ok=True)
        print('Carpeta creada:',path)
    elif kind=='diagnostic':diagnostic(arg)
    else: raise ValueError('Accion desconocida')


def store_history(raw,task,success):
    # Local log, no microphone recordings; no secrets or bridge changes.
    event={'time':dt.datetime.now().isoformat(timespec='seconds'),'phrase':raw[:500],
           'type':task[0] if task else None,'success':success}
    with HISTORY.open('a',encoding='utf-8') as f:
        f.write(json.dumps(event,ensure_ascii=False)+'\n')


def help_text():
    return '''OMEGA V5 — EJEMPLOS (tambien puedes escribirlos en lugar de hablar)
  Hola Omega abre Internet / Word / CMD / PowerShell / Paint
  Omega abre el explorador y entra en descargas
  Abre un bloc de notas limpio y habla sobre hologramas
  Abre la calculadora y multiplica cuatro por cuatro
  Crea un PDF sobre hologramas
  Crea un documento Word sobre hologramas
  Crea un Excel sobre presupuesto
  Convierte el ultimo documento a PDF
  Une los dos ultimos PDF / extrae texto del ultimo PDF / cuantas paginas tiene el ultimo PDF
  Abre el ultimo PDF / lista documentos omega
  Busca en internet hologramas volumetricos
  Muestra procesos / servicios / red / discos / sistema / fecha
  Ejecuta comando ipconfig / whoami / hostname / Get-Process / Get-Service / Get-Date
  Crea carpeta proyectos
  /ayuda /salir
Limitaciones: comandos CMD/PowerShell predefinidos y de solo lectura.
No se ejecutan scripts libres, borrados, correos, compras o tareas remotas.
'''


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--text',help='Procesar una frase escrita y salir (sin microfono)')
    ap.add_argument('--tests',action='store_true')
    ap.add_argument('--model',choices=('base','small'),default='small')
    ap.add_argument('--seconds',type=int,default=10)
    args=ap.parse_args()
    if args.tests:
        cases=[
            ('Hola Omega. Abre la calculadora.','app'),
            ('Ola Omega abre el bloc de notas','app'),
            ('Hola Omega abre Internet','app'),
            ('Por la Omega. Abre el explorador. Entro en descargas.','folder'),
            ('Abre la calculadora y multiplica 4 por 4','calc_open'),
            ('Abre un blog de notas limpio y habla sobre hologramas','note'),
            ('Crea un documento Word sobre hologramas','create'),
            ('Crea un PDF sobre hologramas','create'),
            ('Crea un Excel sobre presupuesto','create'),
            ('Convierte el ultimo documento a PDF','to_pdf'),
            ('Une los dos ultimos PDF','pdf_merge'),
            ('Extrae texto del ultimo PDF','pdf_extract'),
            ('Cuantas paginas tiene el ultimo PDF','pdf_pages'),
            ('Abre el ultimo PDF','latest'),
            ('Muestra procesos','diagnostic'),
            ('Muestra servicios','diagnostic'),
            ('Ejecuta comando ipconfig','diagnostic'),
            ('Ejecuta comando whoami','diagnostic'),
            ('Ejecuta powershell comando Get-Process','diagnostic'),
            ('Abre cmd','app'),
            ('Abre powershell','app'),
            ('Busca en internet hologramas','search'),
            ('Lista documentos omega','list'),
            ('Crea carpeta proyectos','newfolder'),
            ('Escribe hola mundo','write'),
            ('Abre el H',None),
            ('Abre calculadora y borra documentos',None),
            ('Ejecuta PowerShell Remove-Item C:',None),
            ('Ejecuta cmd format C:',None),
            ('Manda un email a alguien',None),
            ('Borra los archivos de descargas',None),
        ]
        fails=0
        for phrase,expected in cases:
            result=classify(phrase)
            actual=result[0] if result else None
            if actual!=expected:
                print('FALLO:',phrase,'=>',actual,'esperado',expected);fails+=1
        for ex,out in [('multiplica 4 por 4','4 * 4 = 16'),('cuatro por cuatro','4 * 4 = 16'),('dos mas tres','2 + 3 = 5')]:
            result=calculate(ex)
            if result != out:print('FALLO CALC:',ex,result);fails+=1
        # Verify actual file formats, not merely filenames.
        import tempfile
        with tempfile.TemporaryDirectory() as temp:
            tmp=Path(temp)
            pdf=tmp/'prueba.pdf'
            docx=tmp/'prueba.docx'
            xlsx=tmp/'prueba.xlsx'
            write_pdf(pdf,['Omega - prueba PDF','Hologramas y tecnologia'])
            write_docx(docx,['Omega - prueba Word','Texto de prueba'])
            write_xlsx(xlsx,'presupuesto')
            if not (pdf.read_bytes().startswith(b'%PDF-') and pdf.read_bytes().rstrip().endswith(b'%%EOF')):
                print('FALLO PDF');fails+=1
            for path,required in [(docx,'word/document.xml'),(xlsx,'xl/worksheets/sheet1.xml')]:
                with zipfile.ZipFile(path) as z:
                    if z.testzip() or required not in z.namelist():
                        print('FALLO DOCUMENTO:',path);fails+=1
                    else:
                        ET.fromstring(z.read(required))
            print('ARCHIVOS: PDF / DOCX / XLSX validados')
        print('PRUEBAS:',len(cases)+3-fails,'/',len(cases)+3)
        return 1 if fails else 0
    print('OMEGA OPERADOR 5.0 | WHISPER LOCAL | CMD / POWERSHELL / PDF / DOCX / XLSX')
    print('Sin nube, sin cambios en Vercel ni en el puente remoto.')
    print(help_text())
    if args.text:
        task=classify(args.text)
        if not task:print('No reconozco una accion autorizada:',args.text);return 2
        print('ORDEN:',task)
        execute(task)
        store_history(args.text,task,True)
        return 0
    try:
        import numpy as np
        import sounddevice as sd
        from faster_whisper import WhisperModel
    except ImportError as exc:
        print('ERROR: faltan dependencias Whisper',exc)
        return 3
    print('Cargando Whisper local',args.model,flush=True)
    model=WhisperModel(args.model,device='cpu',compute_type='int8')
    print('LISTO: INTRO=hablar | escribe una frase y INTRO=procesar texto | /ayuda | /salir')
    while True:
        try:request=input('\nOMEGA 5 > ').strip()
        except (EOFError,KeyboardInterrupt):break
        if request.lower() in ('q','salir','/salir','exit'):break
        if request.lower() in ('/ayuda','ayuda','?'):print(help_text());continue
        if request:
            phrase=request
        else:
            try:
                print('GRABANDO',args.seconds,'segundos...',flush=True)
                signal=sd.rec(int(RATE*args.seconds),samplerate=RATE,channels=1,dtype='float32')
                sd.wait()
                audio=np.asarray(signal[:,0],dtype=np.float32)
                peak=float(np.max(np.abs(audio)))
                rms=float(np.sqrt(np.mean(np.square(audio))))
                print('Audio: pico %.3f rms %.3f'%(peak,rms))
                if rms<.001 or peak<.005:
                    print('Audio insuficiente, no se ejecuta nada');continue
                parts,info=model.transcribe(audio,language='es',beam_size=5,vad_filter=True,
                        condition_on_previous_text=False,initial_prompt='Omega. Calculadora. Explorador de archivos. Descargas. Bloc de notas. PowerShell. CMD. PDF. Word. Excel.')
                phrase=' '.join(p.text.strip() for p in parts).strip()
                print('RECONOCIDO:',phrase)
                if not phrase:continue
            except Exception as exc:
                print('ERROR MICROFONO:',exc);continue
        task=classify(phrase)
        if not task:
            print('No hay accion segura para esta frase. Prueba /ayuda; no hay que entrenar una a una.')
            store_history(phrase,None,False)
            continue
        print('INTERPRETADO:',task[0],task[1])
        try:
            execute(task)
            store_history(phrase,task,True)
        except Exception as exc:
            print('ERROR AL EJECUTAR:',type(exc).__name__,str(exc))
            store_history(phrase,task,False)
    print('OMEGA detenido')
    return 0

if __name__=='__main__':
    sys.exit(main())
