'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const supaUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
const supaKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
type AppName = 'notepad' | 'calculator' | 'explorer' | 'paint' | 'snipping' | 'edge' | 'chrome' | 'settings' | 'word' | 'excel' | 'powerpoint' | 'vscode';
type Job = { id:string;app:AppName;status:string;created_at:string;result_text?:string|null };
type State = { connected?:boolean;jobs?:Job[];error?:string;agentVersion?:string|null };
const apps: ReadonlyArray<{value:AppName;label:string}> = [
  { value: 'notepad', label: 'Bloc de notas' },
  { value: 'calculator', label: 'Calculadora' },
  { value: 'explorer', label: 'Explorador' },
  { value: 'paint', label: 'Paint' },
  { value: 'snipping', label: 'Recortes' },
  { value: 'edge', label: 'Microsoft Edge' },
  { value: 'chrome', label: 'Google Chrome' },
  { value: 'settings', label: 'Configuración' },
  { value: 'word', label: 'Microsoft Word' },
  { value: 'excel', label: 'Microsoft Excel' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'vscode', label: 'Visual Studio Code' }
];
const synonyms: Record<AppName,string[]> = {
  notepad: ["bloc de notas", "notepad", "editor de texto"],
  calculator: ["calculadora", "calculator", "calc"],
  explorer: ["explorador de archivos", "explorador", "carpetas"],
  paint: ["paint", "dibujar"],
  snipping: ["recortes", "captura de pantalla", "snipping"],
  edge: ["microsoft edge", "edge", "navegador"],
  chrome: ["google chrome", "chrome"],
  settings: ["configuracion", "ajustes de windows"],
  word: ["word", "documento de word"],
  excel: ["excel", "hoja de calculo"],
  powerpoint: ["powerpoint", "presentacion"],
  vscode: ["visual studio code", "vs code", "vscode", "editor de codigo"]
};

function normalize(text:string) {
  return text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
}
function classify(text:string): AppName|null {
  const t=normalize(text);
  if (!t || t.length>500) return null;
  // Evitar ejecutar negaciones o citas ambiguas como una orden.
  if (/\b(no|nunca|evita|sin)\s+(abras?|inicies?|ejecutes?)\b/.test(t)) return null;
  if (!/\b(abre|abrir|inicia|iniciar|ejecuta|ejecutar|pon|poner|lanza|lanzar)\b/.test(t)) return null;
  const candidates=apps.filter(a=>synonyms[a.value].some(term=>t.includes(term)));
  return candidates.length===1 ? candidates[0].value : null;
}

type SR = {
  lang:string;interimResults:boolean;continuous:boolean;
  onresult:((event:{results:ArrayLike<ArrayLike<{transcript:string}>>})=>void)|null;
  onerror:((event:{error:string})=>void)|null;
  onend:(()=>void)|null;
  start:()=>void;stop:()=>void;
};

type SRConstructor = new()=>SR;
export default function OmegaWindowsRemote(){
  const [access,setAccess]=useState<'checking'|'hidden'|'visible'>('checking');
  const [state,setState]=useState<State|null>(null);
  const [app,setApp]=useState<AppName>('notepad');
  const [phrase,setPhrase]=useState('');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [listening,setListening]=useState(false);
  const recorder=useRef<SR|null>(null);

  const sessionToken=useCallback(async()=>{
    if(!supaUrl||!supaKey)return null;
    const supabase=createBrowserClient(supaUrl,supaKey);
    const {data,error}=await supabase.auth.getSession();
    return error?null:data.session?.access_token||null;
  },[]);
  const load=useCallback(async()=>{
    try {
      const token=await sessionToken();
      if(!token){setAccess('hidden');return;}
      const res=await fetch('/api/omega-windows',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      if(res.status===401||res.status===403){setAccess('hidden');setState(null);return;}
      const body=await res.json() as State;
      setState(res.ok?body:{connected:false,error:body.error||`HTTP ${res.status}`});
      setAccess('visible');
    } catch { setAccess('visible');setState({connected:false,error:'Error de red del agente'}); }
  },[sessionToken]);
  useEffect(()=>{
    if(!supaUrl||!supaKey)return;
    const supabase=createBrowserClient(supaUrl,supaKey);
    void load();
    const {data}=supabase.auth.onAuthStateChange(()=>{window.setTimeout(()=>void load(),0);});
    const timer=window.setInterval(()=>void load(),8000);
    return ()=>{data.subscription.unsubscribe();window.clearInterval(timer);recorder.current?.stop();};
  },[load]);

  async function dispatch(target:AppName){
    if(busy||!state?.connected)return;
    setBusy(true);setApp(target);setMessage('Enviando orden a Windows...');
    try{
      const token=await sessionToken();
      if(!token)throw new Error('Sesión ADMIN caducada; verifica MFA.');
      const res=await fetch('/api/omega-windows',{method:'POST',cache:'no-store',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({app:target})});
      const body=await res.json() as {error?:string};
      if(!res.ok)throw new Error(body.error||`HTTP ${res.status}`);
      setMessage(`Orden para ${apps.find(a=>a.value===target)?.label||target} enviada. El PC aprobará automáticamente solo si activaste la sesión temporal local; en otro caso te preguntará.`);
      await load();
    }catch(e){setMessage(e instanceof Error?e.message:'Orden fallida');}
    finally{setBusy(false);}
  }

  function handleSpeech(text:string){
    setPhrase(text);
    const chosen=classify(text);
    if(chosen){setApp(chosen);setMessage(`Voz reconocida: ${apps.find(a=>a.value===chosen)?.label}.`);void dispatch(chosen);}
    else setMessage('Orden ambigua. Escribe o usa "Interpretar con IA"; no se ha ejecutado nada.');
  }
  function listen(){
    if(typeof window==='undefined')return;
    const w=window as typeof window&{SpeechRecognition?:SRConstructor;webkitSpeechRecognition?:SRConstructor};
    const Ctor=w.SpeechRecognition||w.webkitSpeechRecognition;
    if(!Ctor){setMessage('Tu navegador no admite reconocimiento de voz. Usa Edge o Chrome, o escribe la orden.');return;}
    if(listening){recorder.current?.stop();return;}
    try{
      const sr=new Ctor();recorder.current=sr;
      sr.lang='es-ES';sr.interimResults=false;sr.continuous=false;
      sr.onresult=ev=>handleSpeech(ev.results[0]?.[0]?.transcript||'');
      sr.onerror=ev=>{setListening(false);setMessage(`Micrófono: ${ev.error}`);};
      sr.onend=()=>setListening(false);
      sr.start();setListening(true);setMessage('Escuchando una orden...');
    }catch(e){setMessage(e instanceof Error?e.message:'No se pudo abrir el micrófono');}
  }

  async function interpretWithAI(){
    if(busy||!phrase.trim()||phrase.length>450)return;
    const token=await sessionToken();
    if(!token){setMessage('Inicia sesión ADMIN y verifica MFA.');return;}
    setBusy(true);setMessage('Interpretando con OMEGA IA (consume una consulta OpenRouter)...');
    try{
      const prompt=`Clasifica esta orden del usuario en UNA aplicación. Responde ÚNICAMENTE JSON válido como {"app":"notepad"} o {"app":null}. No inventes acciones. Opciones: ${apps.map(a=>a.value).join(', ')}. Orden: ${phrase.trim()}`;
      if(prompt.length>1000)throw new Error('Orden demasiado larga');
      const res=await fetch('/api/omega-admin/ai',{method:'POST',cache:'no-store',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({approval:'consult_paid_ai',prompt})});
      const body=await res.json() as {answer?:string;error?:string};
      if(!res.ok||!body.answer)throw new Error(body.error||`HTTP ${res.status}`);
      const raw=body.answer.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
      let result:unknown;
      try{result=JSON.parse(raw);}catch{throw new Error('La IA no devolvió un comando válido. No se ejecutó nada.');}
      const selected=(result&&typeof result==='object'&&'app' in result)?(result as {app:unknown}).app:null;
      if(typeof selected!=='string'||!apps.some(a=>a.value===selected))throw new Error('La IA no reconoció una aplicación permitida.');
      setApp(selected as AppName);
      setMessage(`OMEGA propone: ${apps.find(a=>a.value===selected)?.label}. Pulsa «Enviar orden» para ejecutarla. No hay ejecución automática de decisiones de IA.`);
    }catch(e){setMessage(e instanceof Error?e.message:'Falló el análisis de IA');}
    finally{setBusy(false);}
  }

  if(access!=='visible')return null;
  return <section aria-label="OMEGA operador Windows voz" style={{margin:'18px 0',padding:18,width:'100%',borderRadius:14,border:'1px solid #6485a9',background:'#132439',color:'#f1fcff'}}>
    <h3 style={{margin:'0 0 8px'}}>Ω Operador Windows · VOZ + IA · ADMIN</h3>
    <p>Agente Windows: <strong>{state?.connected?'CONECTADO':'SIN CONEXIÓN'}</strong>. Control remoto reservado a ADMIN con MFA.</p>
    {state?.error&&<p role="status">{state.error}</p>}
    <p style={{opacity:.9}}>Di «abre Paint», «abre Excel», «abre navegador» o «abre Calculadora». Cada orden de voz reconocida para una aplicación permitida se envía al PC. El modo de sesión confiable se activa físicamente en tu ordenador.</p>
    <button type="button" onClick={listen} disabled={busy||!state?.connected}
      style={{padding:'12px 16px',marginBottom:10,borderRadius:8,background:'#65e0e5',color:'#05202a',fontWeight:700,border:0}}>
      {listening?'Detener micrófono':'🎙 Hablar a OMEGA'}
    </button>
    <label htmlFor="omega-voice-phrase" style={{display:'block',margin:'6px 0'}}>Orden por voz o texto</label>
    <input id="omega-voice-phrase" value={phrase} maxLength={450} onChange={e=>setPhrase(e.target.value)}
      placeholder="Abre PowerPoint" style={{padding:10,width:'100%',background:'#081928',color:'white',borderRadius:7}}/>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:10}}>
      <button type="button" onClick={()=>{const found=classify(phrase);if(found)void dispatch(found);else setMessage('No se reconoce una orden directa. Usa «Interpretar con IA».');}} disabled={busy||!state?.connected}
        style={{padding:'10px 13px',borderRadius:8,fontWeight:700}}>Ejecutar orden reconocida</button>
      <button type="button" onClick={()=>void interpretWithAI()} disabled={busy||!state?.connected||!phrase.trim()}
        style={{padding:'10px 13px',borderRadius:8}}>Interpretar con IA (consulta de pago)</button>
    </div>
    <label htmlFor="omega-windows-app" style={{display:'block',margin:'14px 0 6px'}}>Seleccionar aplicación</label>
    <select id="omega-windows-app" value={app} onChange={e=>setApp(e.target.value as AppName)} style={{padding:10,width:'100%',maxWidth:360,background:'#081928',color:'white',borderRadius:7}}>
      {apps.map(a=><option key={a.value} value={a.value}>{a.label}</option>)}
    </select>
    <button type="button" onClick={()=>void dispatch(app)} disabled={busy||!state?.connected}
      style={{marginLeft:8,padding:'10px 13px',borderRadius:8,fontWeight:700,background:'#65e0e5',color:'#05202a',border:0}}>
      {busy?'Procesando…':'Enviar orden a Windows'}
    </button>
    {message&&<p role="status" aria-live="polite" style={{marginTop:12}}>{message}</p>}
    {state?.jobs?.length ? <ul style={{paddingLeft:20,marginTop:12}}>{state.jobs.map(j=><li key={j.id}>{apps.find(a=>a.value===j.app)?.label||j.app}: {j.status} {j.result_text||''}</li>)}</ul>:null}
    <p style={{fontSize:'.82rem',opacity:.85,marginTop:12}}>No es todavía control visual total del escritorio. Las acciones de IA solo proponen una aplicación permitida. No se ejecutan comandos arbitrarios, UAC ni cambios de administrador. Si el navegador no admite micrófono, puedes escribir.</p>
  </section>;
}
