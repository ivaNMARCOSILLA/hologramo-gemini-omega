#!/usr/bin/env python3
"""OMEGA 4 local-only, allowlisted voice operator with bounded phrase learning."""
import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import unicodedata
import uuid
import webbrowser
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.sax.saxutils import escape

HERE = Path(__file__).resolve().parent
MEMORY = HERE / "memoria-voz.json"
REPORT = HERE / "diagnostico-omega4.json"
ACTIONS = {
    "calculadora": "calculator",
    "calculator": "calculator",
    "calc": "calculator",
    "bloc de notas": "notepad",
    "notepad": "notepad",
    "explorador": "explorer",
    "explorador de archivos": "explorer",
    "administrador de archivos": "explorer",
    "internet": "browser",
    "navegador": "browser",
    "navegador web": "browser",
    "google": "browser",
    "descargas": "downloads",
    "carpeta de descargas": "downloads",
    "mis descargas": "downloads",
    "escritorio": "desktop",
    "mi escritorio": "desktop",
    "documentos": "documents",
    "mis documentos": "documents",
    "word": "word",
    "microsoft word": "word",
    "excel": "excel",
    "microsoft excel": "excel",
    "powerpoint": "powerpoint",
    "power point": "powerpoint",
    "paint": "paint",
    "pintura": "paint",
    "configuracion": "settings",
    "ajustes": "settings",
}
ALLOWED = frozenset(ACTIONS.values())
ALIASES_LEARNABLE = {"calculator", "notepad", "explorer", "browser", "downloads", "desktop", "documents", "word", "excel", "powerpoint", "paint", "settings"}
DANGEROUS = re.compile(r"\b(?:borra|borrar|elimina|eliminar|destruye|formatea|formatear|apaga|apagar|reinicia|reiniciar|desinstala|desinstalar|instala|instalar|powershell|cmd|terminal|contrasena|clave|password|transfiere|transfiera|compra|comprar|pagar|paga|envia|enviar|sube|subir|descarga un|descargar un|modifica el registro)\b")


def normalize(text):
    text = unicodedata.normalize("NFKD", str(text).casefold())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_address(phrase):
    # The imperfect audio samples supplied by the user included "Por la Omega".
    patterns = [
        r"^(?:(?:hola|ola|oye|buenos dias|buenas tardes|buenas noches)\s+)?omega\b\s*",
        r"^por la omega\b\s*",
        r"^por favor\s+",
    ]
    for _ in range(4):
        before = phrase
        for pat in patterns:
            phrase = re.sub(pat, "", phrase, count=1)
        if phrase == before:
            break
    return phrase


def classify(text, memory=None):
    original = normalize(text)
    if not original or len(original) > 500:
        return None
    if DANGEROUS.search(original):
        return None
    memory = memory or {}
    alias = memory.get(original)
    if isinstance(alias, str) and alias in ALIASES_LEARNABLE:
        return alias, ""
    phrase = strip_address(original)
    phrase = re.sub(r"\s+por favor$", "", phrase)
    phrase = re.sub(r"^(?:por favor\s+)", "", phrase)
    phrase = re.sub(r"^(?:puedes|podrias)\s+", "", phrase)
    phrase = re.sub(r"^(?:quiero que|necesito que)\s+", "", phrase)
    phrase = re.sub(r"^me\s+", "", phrase)

    # Create a genuine DOCX draft (without claiming an AI-written report).
    match = re.fullmatch(r"(?:crea|crear|prepara|preparar|haz|genera)\s+(?:un\s+)?(?:nuevo\s+)?(?:documento|archivo|informe)\s+(?:de\s+)?(?:word|docx)\s+(?:sobre|titulado|llamado)\s+(.+)", phrase)
    if match:
        topic = match.group(1).strip()
        if 2 <= len(topic) <= 120:
            return "new_doc", topic
        return None

    verb = r"(?:abre|abrir|inicia|ejecuta|muestra|ve a|entra en|abrir el|abreme|abrelo)"
    match = re.fullmatch(rf"{verb}\s+(?:(?:el|la|los|las|mi|mis)\s+)?(.+)", phrase)
    if not match:
        return None
    target = match.group(1).strip()
    # Multi-step request: open Explorer in Downloads. Do not guess unrelated content.
    combo = re.fullmatch(r"(?:el\s+)?(?:explorador|explorador de archivos|administrador de archivos)\s+(?:(?:y\s+)?(?:entra|entro|entrar|ve|ir)\s+(?:en|a)\s+(?:la|las|mis)?\s*descargas)", target)
    if combo:
        return "downloads", ""
    if target in ACTIONS:
        return ACTIONS[target], ""
    return None


def read_memory():
    if not MEMORY.exists():
        return {}
    try:
        data = json.loads(MEMORY.read_text(encoding="utf-8"))
        aliases = data.get("aliases", {})
        if not isinstance(aliases, dict):
            return {}
        return {key: value for key, value in aliases.items()
                if isinstance(key, str) and key == normalize(key) and len(key) <= 500
                and isinstance(value, str) and value in ALIASES_LEARNABLE
                and not DANGEROUS.search(key)}
    except (OSError, ValueError, TypeError):
        return {}


def write_memory(memory):
    HERE.mkdir(exist_ok=True, parents=True)
    temp = MEMORY.with_suffix('.json.tmp')
    temp.write_text(json.dumps({"version": 1, "aliases": memory}, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp, MEMORY)


def known_folder(name):
    if sys.platform == "win32":
        try:
            import winreg
            names = {
                "downloads": "{374DE290-123F-4565-9164-39C4925E467B}",
                "documents": "Personal",
                "desktop": "Desktop",
            }
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders") as key:
                val, _ = winreg.QueryValueEx(key, names[name])
                val = os.path.expandvars(val)
                # Common OneDrive redirect and environment paths.
                p = Path(val)
                if p.is_dir():
                    return p
        except (OSError, KeyError, ValueError):
            pass
    p = Path.home() / {"downloads": "Downloads", "documents": "Documents", "desktop": "Desktop"}[name]
    return p


def make_docx(topic):
    folder = known_folder("documents") / "OMEGA-Documentos"
    folder.mkdir(parents=True, exist_ok=True)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "-", normalize(topic))[:50].strip("-") or "documento"
    target = folder / f"OMEGA-{datetime.datetime.now():%Y%m%d-%H%M%S}-{safe_name}-{uuid.uuid4().hex[:5]}.docx"
    paragraphs = [
        ("Documento de trabajo OMEGA", True),
        (f"Tema: {topic}", True),
        ("Borrador inicial creado a partir de una orden de voz. No contiene investigación ni hechos verificados.", False),
        ("1. Objetivo", True),
        (f"Preparar un documento sobre {topic}.", False),
        ("2. Ideas principales", True),
        ("[Añadir aquí la información y las fuentes que quieras utilizar.]", False),
        ("3. Desarrollo", True),
        ("[Completar el contenido y revisar los datos.]", False),
        ("4. Conclusiones", True),
        ("[Redactar conclusiones después de completar el documento.]", False),
    ]
    rows = []
    for line, bold in paragraphs:
        t = escape(line)
        rp = "<w:rPr><w:b/></w:rPr>" if bold else ""
        rows.append(f'<w:p><w:r>{rp}<w:t xml:space="preserve">{t}</w:t></w:r></w:p>')
    doc = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
           '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
           '<w:body>' + ''.join(rows) + '<w:sectPr/></w:body></w:document>')
    types = ('<?xml version="1.0" encoding="UTF-8"?>'
             '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
             '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
             '<Default Extension="xml" ContentType="application/xml"/>'
             '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
             '</Types>')
    rels = ('<?xml version="1.0" encoding="UTF-8"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            '</Relationships>')
    with zipfile.ZipFile(target, "x", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", doc)
    with zipfile.ZipFile(target, "r") as zf:
        assert zf.testzip() is None
        ET.fromstring(zf.read("word/document.xml"))
    return target


def act(intent):
    action, payload = intent
    if action == "new_doc":
        path = make_docx(payload)
        print(f"Documento creado y verificado: {path}", flush=True)
        if sys.platform == "win32":
            try:
                os.startfile(str(path))
            except OSError as exc:
                print(f"Guardado correctamente; no se ha podido abrir: {exc}", flush=True)
        return
    if sys.platform != "win32":
        raise RuntimeError("Las acciones del escritorio solo funcionan en Windows.")
    if action == "browser":
        if not webbrowser.open("https://www.google.com/", new=1):
            raise RuntimeError("No se pudo abrir el navegador predeterminado.")
    elif action in ("downloads", "desktop", "documents"):
        p = known_folder(action)
        if not p.is_dir():
            raise RuntimeError(f"La carpeta no existe: {p}")
        subprocess.Popen(["explorer.exe", str(p)])
    elif action == "explorer":
        subprocess.Popen(["explorer.exe"])
    elif action in ("calculator", "notepad", "paint"):
        apps = {"calculator": "calc.exe", "notepad": "notepad.exe", "paint": "mspaint.exe"}
        subprocess.Popen([apps[action]])
    elif action in ("word", "excel", "powerpoint"):
        exe = {"word": "winword.exe", "excel": "excel.exe", "powerpoint": "powerpnt.exe"}[action]
        try:
            os.startfile(exe)
        except OSError as exc:
            raise RuntimeError(f"La aplicacion {action} no esta disponible o no se encuentra: {exc}") from exc
    elif action == "settings":
        os.startfile("ms-settings:")
    else:
        raise RuntimeError("Accion no autorizada")
    print(f"OMEGA: accion local enviada: {action}", flush=True)


def selftest():
    cases = [
        ("Hola Omega. Abre la calculadora.", "calculator"),
        ("Ola Omega. Abre el Bloc de notas.", "notepad"),
        ("Hola Omega abre el explorador", "explorer"),
        ("Hola, Omega. Abre el Internet.", "browser"),
        ("Por la Omega. Abre el explorador. Entro en descargas.", "downloads"),
        ("Abre el explorador y entra en descargas", "downloads"),
        ("Omega abre la carpeta de descargas", "downloads"),
        ("Omega abre el navegador", "browser"),
        ("Omega ve a documentos", "documents"),
        ("Oye Omega abre Word", "word"),
        ("Abre Excel", "excel"),
        ("Omega abre Power Point", "powerpoint"),
        ("Omega crea un documento Word sobre hologramas", "new_doc"),
        ("Hola Omega. Abre el H.", None),
        ("Ola Omega. Abre la calculadora de archivos.", None),
        ("Abre calculadora y elimina archivos", None),
        ("Abre internet y borra datos", None),
        ("Ejecuta PowerShell", None),
        ("Abre cmd", None),
        ("Hola Omega", None),
        ("Abre explorer.exe", None),
        ("Crea un archivo Word y ejecuta comandos", None),
    ]
    errors = 0
    for spoken, expected in cases:
        actual = classify(spoken)
        value = actual[0] if actual else None
        print(("OK" if value == expected else "FALLO"), repr(spoken), "=>", value, flush=True)
        errors += int(value != expected)
    print(f"PRUEBAS: {len(cases)-errors}/{len(cases)}", flush=True)
    return errors == 0


def save_report(stats, extra=None):
    data = {"version": "4.0", "updated_at": datetime.datetime.now().isoformat(timespec="seconds"), "stats": stats, "memory_aliases": len(read_memory())}
    if extra:
        data.update(extra)
    REPORT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--model", choices=["base", "small"], default="small")
    ap.add_argument("--seconds", type=int, default=10)
    args = ap.parse_args()
    if args.selftest:
        result = selftest()
        sys.exit(0 if result else 1)
    if not 4 <= args.seconds <= 30:
        ap.error("La grabacion debe durar entre 4 y 30 segundos")
    import numpy as np
    import sounddevice as sd
    from faster_whisper import WhisperModel

    stats = {"recordings": 0, "transcribed": 0, "executed": 0, "unrecognized": 0, "errors": 0, "corrected": 0, "auto_learned": 0}
    memory = read_memory()
    last_unknown = None
    print("\n=== OMEGA OPERADOR 4.0 | WHISPER LOCAL ===")
    print("Audio y transcripcion locales; solo se descarga el modelo si aun falta. Puente remoto intacto.")
    print("Cargando Whisper", args.model, "en CPU...", flush=True)
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    print("PREPARADO. INTRO = hablar | /corrige destino = ensenar | /ayuda | q = salir")
    print("Destinos: calculadora, bloc, explorador, descargas, internet, escritorio, documentos, word, excel, powerpoint, paint, ajustes.")
    print("Tambien: 'crea un documento Word sobre hologramas'.")
    while True:
        try:
            line = input("\nOMEGA 4 > ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if line.casefold() in ("q", "salir", "exit", "/salir"):
            break
        if line.casefold() in ("/ayuda", "ayuda", "/help"):
            print("INTRO: grabar 10 segundos; /corrige descargas: asociar ultima frase mal reconocida a descargas; /prueba texto: simular sin abrir; /memoria: ver numero de asociaciones; q: salir")
            continue
        if line.casefold() == "/memoria":
            print("Frases aprendidas localmente:", len(memory))
            continue
        if line.casefold().startswith("/corrige "):
            target = normalize(line[len('/corrige '):])
            resolved = ACTIONS.get(target)
            if resolved not in ALIASES_LEARNABLE:
                print("Destino no admitido. Elige una app o carpeta autorizada.")
                continue
            if not last_unknown or DANGEROUS.search(normalize(last_unknown)):
                print("No hay frase reciente apta para aprender.")
                continue
            try:
                answer = input(f'Aprender que "{last_unknown}" significa {resolved}? (s/N) ').strip().casefold()
            except (EOFError, KeyboardInterrupt):
                break
            if answer not in ("s", "si", "sí"):
                print("Sin cambios.")
                continue
            memory[normalize(last_unknown)] = resolved
            write_memory(memory)
            stats["corrected"] += 1
            print("Correccion guardada solo en este PC. Se aplicara en futuras grabaciones.")
            last_unknown = None
            continue
        if line.casefold().startswith("/prueba "):
            spoken = line[len('/prueba '):]
            parsed = classify(spoken, memory)
            print("SIMULACION:", parsed if parsed else "Sin accion", "(no se ejecuta)")
            continue
        if line:
            print("Pulsa INTRO sin escribir texto para grabar. /ayuda muestra las opciones.")
            continue
        try:
            stats["recordings"] += 1
            print(f"GRABANDO {args.seconds} SEGUNDOS. Habla ahora...", flush=True)
            samples = sd.rec(int(16000 * args.seconds), samplerate=16000, channels=1, dtype="float32")
            sd.wait()
            audio = np.asarray(samples[:, 0], dtype=np.float32)
            peak = float(np.max(np.abs(audio)))
            rms = float(np.sqrt(np.mean(audio ** 2)))
            print(f"Senal: pico={peak:.4f} rms={rms:.4f}", flush=True)
            if rms < .001 or peak < .005:
                print("Audio insuficiente; no se ejecuta nada.")
                stats["unrecognized"] += 1
                continue
            hints = "Omega. Hola Omega. Abre Internet. Abre el explorador. Entra en Descargas. Abre el Bloc de notas. Crea un documento Word."
            if memory:
                hints += " " + " ".join(list(memory.keys())[-12:])[:600]
            print("Transcribiendo localmente...", flush=True)
            chunks, info = model.transcribe(audio, language="es", beam_size=5, vad_filter=True, condition_on_previous_text=False, initial_prompt=hints)
            spoken = " ".join(chunk.text.strip() for chunk in chunks).strip()
            if not spoken:
                print("No se reconocio una frase suficiente.")
                stats["unrecognized"] += 1
                last_unknown = None
                continue
            stats["transcribed"] += 1
            print("RECONOCIDO:", spoken, flush=True)
            parsed = classify(spoken, memory)
            if not parsed:
                stats["unrecognized"] += 1
                last_unknown = spoken
                print("Sin accion segura. Puedes escribir /corrige descargas (u otro destino), confirmar una vez, y OMEGA recordara esa frase.")
                continue
            last_unknown = None
            act(parsed)
            stats["executed"] += 1
            # Aprende automaticamente expresiones que ya se interpretaron de
            # forma determinista y se ejecutaron con exito; nunca aprende
            # ordenes desconocidas o sensibles sin correccion explicita.
            if parsed[0] in ALIASES_LEARNABLE:
                key = normalize(spoken)
                if key not in memory:
                    try:
                        memory[key] = parsed[0]
                        if len(memory) > 150:
                            memory.pop(next(iter(memory)))
                        write_memory(memory)
                        stats["auto_learned"] += 1
                    except OSError as exc:
                        print(f"Aviso: no se pudo guardar aprendizaje local: {exc}")
        except (Exception, KeyboardInterrupt) as exc:
            if isinstance(exc, KeyboardInterrupt):
                print("Interrumpido.")
                continue
            stats["errors"] += 1
            print(f"ERROR CONTROLADO: {type(exc).__name__}: {exc}", flush=True)
        finally:
            try:
                save_report(stats, {"model": args.model, "seconds": args.seconds})
            except OSError:
                pass
    try:
        save_report(stats, {"model": args.model, "seconds": args.seconds})
    except OSError:
        pass
    print("OMEGA detenido. Diagnostico:", REPORT)


if __name__ == '__main__':
    main()
