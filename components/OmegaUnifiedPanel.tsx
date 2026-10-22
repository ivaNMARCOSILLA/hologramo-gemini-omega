// OMEGA_SIN_IA_AVANZADA_V9
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject, PointerEvent as ReactPointerEvent } from "react";
import {
  Activity, BookOpen, Check, ChevronRight, ClipboardCopy, ClipboardPaste, Code2, Cpu, Download, FileSignature,
  FolderOpen, Home, Info, Keyboard, LayoutDashboard, Mic, MicOff, Monitor, Play, RefreshCw,
  ShieldAlert, ShieldCheck, Square, Terminal, Trash2, Volume2, WandSparkles
} from "lucide-react";
import { routeOmegaIntent } from "@/lib/omega-router-v05";
import type { OmegaPlan } from "@/lib/omega-router-v05";
import catalogue from "@/data/omega-recetas-v05.json";
import type { OmegaAVCommand } from "@/lib/omega-av-v07";
import { routeOmegaCommand, OMEGA_VOICE_EXAMPLES, type OmegaCommand } from "@/lib/omega-command-v11"; // OMEGA_VOICE_TOTAL_V11
import OmegaV09CommandStrip from "@/components/OmegaV09CommandStrip";
import OmegaV09Account from "@/components/OmegaV09Account";

type Section = "cuenta" | "inicio" | "acciones" | "codigo" | "avisos" | "herramientas" | "conocimiento" | "ajustes";
type AgentStatus = { autoOpenSafe?: boolean; agent?: string; version?: string; mode?: string; busy?: boolean; armed?: boolean; error?: string };
type Diagnostics = { system?: string; osVersion?: string; kernel?: string; architecture?: string; logicalProcessors?: number; ramGB?: number; availableRamGB?: number; privilege?: string };
type Notice = { id: number; title: string; detail: string; kind: "info" | "warning"; read: boolean };
type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraStatus: "connecting" | "active" | "blocked";
  handDetected: boolean;
  isGrabbing: boolean;
  micStatus: "idle" | "listening" | "blocked" | "unsupported";
  conversationEnabled: boolean;
  liveTranscript: string;
  lastUserVoice: string;
  reply: string;
  isProcessing: boolean;
  isSpeaking: boolean;
  onDictateCode: () => void;
  onDictateEditor: () => void;
  onToggleConversation: () => void;
  onDictateWindows: () => void;
  onAsk: (question: string) => void;
};
const navigation: { id: Section; label: string; icon: typeof Home }[] = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "cuenta", label: "Mi cuenta", icon: ShieldCheck },
  { id: "acciones", label: "Acciones", icon: Play },
  { id: "codigo", label: "Código por voz", icon: Code2 },
  { id: "avisos", label: "Avisos", icon: ShieldCheck },
  { id: "herramientas", label: "Herramientas", icon: Keyboard },
  { id: "conocimiento", label: "Conocimiento", icon: BookOpen },
  { id: "ajustes", label: "Ajustes", icon: Cpu },
];
const quick: { text: string; description: string }[] = [
  { text: "abre calculadora", description: "Aplicación permitida" },
  { text: "abre bloc de notas", description: "Editor de Windows" },
  { text: "abre explorador", description: "Archivos y carpetas" },
  { text: "diagnóstico de Windows", description: "CPU, RAM y versión" },
];

export default function OmegaUnifiedPanel({
  videoRef, cameraStatus, handDetected, isGrabbing, micStatus, conversationEnabled,
  liveTranscript, lastUserVoice, reply, isProcessing, isSpeaking,
  onDictateCode, onDictateEditor, onToggleConversation, onDictateWindows, onAsk,
}: Props) {
  const [section, setSection] = useState<Section>("inicio");
  // OMEGA_AV_V07: las ideas se guardan solo de forma explícita, en este navegador/origen.
  const [ideas, setIdeas] = useState<string[]>([]);
  const [ideaDraft, setIdeaDraft] = useState("");
  const [storageReady, setStorageReady] = useState(false);
  const [avMessage, setAvMessage] = useState("");
  const [command, setCommand] = useState("");
  const [plan, setPlan] = useState<OmegaPlan | null>(null);
  const [plannedText, setPlannedText] = useState("");
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [safeAuto, setSafeAuto] = useState(false);
  const [safeAutoBusy, setSafeAutoBusy] = useState(false);
  const [feedback, setFeedback] = useState("En espera de órdenes. Las acciones Windows exigen confirmación humana.");
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [editor, setEditor] = useState("");
  const [codePrompt, setCodePrompt] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("powershell");
  const [generatedCode, setGeneratedCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeMessage, setCodeMessage] = useState("Dicta tu idea de código. El texto se guarda en el editor; no se envía a una IA de pago.");
  const [codeEngineLabel, setCodeEngineLabel] = useState("");

  const [infoAutoRead, setInfoAutoRead] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([
    { id: 1, title: "Autorización protegida", detail: "OMEGA nunca aceptará UAC, contraseñas, pagos ni firmas legales automáticamente.", kind: "warning", read: false },
    { id: 2, title: "Panel unificado v0.6", detail: "Las recetas conocidas se clasifican de forma local. La biblioteca ampliada es documentación, no acceso concedido.", kind: "info", read: false },
  ]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [signatureDirty, setSignatureDirty] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [localhost, setLocalhost] = useState<boolean | null>(null);
  useEffect(() => {
    setLocalhost(["127.0.0.1", "localhost"].includes(window.location.hostname));
  }, []);
  const connected = !agentStatus?.error && !!agentStatus?.agent;
  const pendingNotices = notices.filter(n => !n.read).length;
  // Mantiene el resultado de cualquier accion visible fuera de su pestaña.
  useEffect(() => { setAvMessage(feedback); }, [feedback]);

  const writeLog = useCallback((text: string) => {
    // Memoria temporal de metadatos, nunca se registran textos copiados, audio o firmas.
    setLog(old => [new Date().toLocaleTimeString("es-ES") + " · " + text, ...old].slice(0, 15));
  }, []);
  const addNotice = useCallback((title: string, detail: string, kind: Notice["kind"] = "info") => {
    setNotices(old => [{ id: Date.now() + Math.floor(Math.random()*10000), title, detail, kind, read: kind === "info" && infoAutoRead }, ...old].slice(0, 20));
  }, [infoAutoRead]);

  // OMEGA_AV_V07: restauración de menú y notas; no almacenamos chats, contraseñas ni audio.
  useEffect(() => {
    try {
      const savedSection = window.localStorage.getItem("omega:v07:section");
      if (navigation.some(item => item.id === savedSection)) setSection(savedSection as Section);
      const savedIdeas: unknown = JSON.parse(window.localStorage.getItem("omega:v07:ideas") || "[]");
      if (Array.isArray(savedIdeas)) setIdeas(savedIdeas.filter((x): x is string => typeof x === "string").slice(0, 20).map(x => x.slice(0, 600)));
    } catch { /* Almacenamiento privado o desactivado. */ }
    setStorageReady(true);
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { window.localStorage.setItem("omega:v07:section", section); } catch {}
  }, [section, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    try { window.localStorage.setItem("omega:v07:ideas", JSON.stringify(ideas)); } catch {}
  }, [ideas, storageReady]);

  const saveIdea = useCallback((text: string) => {
    const idea = text.trim().slice(0, 600);
    if (!idea) { setFeedback("Escribe o dicta una idea antes de guardarla."); return; }
    setIdeas(old => [idea, ...old.filter(item => item !== idea)].slice(0, 20));
    setIdeaDraft("");
    setSection("conocimiento");
    setFeedback("Idea guardada en este navegador. No se envía al servidor.");
    setAvMessage("Idea guardada: " + idea.slice(0, 130));
    writeLog("Nueva idea guardada localmente");
  }, [writeLog]);

  useEffect(() => {
    const onAVCommand = (event: Event) => {
      const action = (event as CustomEvent<OmegaAVCommand>).detail;
      if (!action || typeof action !== "object") return;
      if (action.kind === "idea") {
        saveIdea(action.text);
        window.dispatchEvent(new CustomEvent("omega:voice-summary", { detail: "Idea guardada en el apartado Conocimiento." }));
      } else if (action.kind === "navigate" && navigation.some(n => n.id === action.section)) {
        setSection(action.section as Section);
        setFeedback("Menú abierto por voz: " + action.label + ".");
        setAvMessage("Sección abierta: " + action.label);
        writeLog("Navegación por voz: " + action.label);
        window.dispatchEvent(new CustomEvent("omega:voice-summary", { detail: "Abriendo " + action.label + "." }));
      }
    };
    const onAVFeedback = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (typeof message === "string") setAvMessage(message.slice(0, 400));
    };
    const onVoiceEditor = (event: Event) => {
      const dictation = (event as CustomEvent<string>).detail;
      if (typeof dictation !== "string" || !dictation.trim()) return;
      setSection("herramientas");
      setEditor(old => old + (old && !/\s$/.test(old) ? " " : "") + dictation.trim());
      setFeedback("Dictado añadido al editor. No se ha enviado a Windows.");
      setAvMessage("Texto añadido al editor: " + dictation.slice(0, 130));
      window.dispatchEvent(new CustomEvent("omega:voice-summary", { detail: "Dictado añadido al editor." }));
    };
    window.addEventListener("omega:av-command", onAVCommand);
    window.addEventListener("omega:av-feedback", onAVFeedback);
    window.addEventListener("omega:voice-editor", onVoiceEditor);
    return () => {
      window.removeEventListener("omega:av-command", onAVCommand);
      window.removeEventListener("omega:av-feedback", onAVFeedback);
      window.removeEventListener("omega:voice-editor", onVoiceEditor);
    };
  }, [saveIdea, writeLog]);

  const refresh = useCallback(async () => {
    if (localhost === null) return;
    if (!localhost) { setAgentStatus({ error: "Solo disponible en localhost; nunca desde el dominio público." }); return; }
    try {
      const response = await fetch("/api/omega-windows", { cache: "no-store" });
      const result: AgentStatus = await response.json();
      setAgentStatus(response.ok ? result : { error: result.error || `HTTP ${response.status}` });
      if (response.ok) setSafeAuto(result.autoOpenSafe === true);
    } catch { setAgentStatus({ error: "Agente local inaccesible" }); }
  }, [localhost]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    function onVoiceCode(event: Event) {
      const spoken = (event as CustomEvent<string>).detail;
      if (typeof spoken !== "string" || !spoken.trim()) return;
      setSection("codigo");
      setCodePrompt(spoken);
      setGeneratedCode("");
      // Si dices el lenguaje, OMEGA lo elige sin pedir otro paso.
      const normalized = spoken.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const lang = /\bpython\b/.test(normalized) ? "python"
        : /\btypescript\b/.test(normalized) ? "typescript"
        : /\bjavascript\b/.test(normalized) ? "javascript"
        : /\b(?:cmd|batch|bat)\b/.test(normalized) ? "batch"
        : /\bpowershell\b/.test(normalized) ? "powershell" : codeLanguage;
      setCodeLanguage(lang);
      setCodeMessage("Voz reconocida. Puedes revisar, copiar o editar tu petición. No se enviará a proveedores de pago.");
    }
    window.addEventListener("omega:voice-code", onVoiceCode);
    return () => window.removeEventListener("omega:voice-code", onVoiceCode);
  }, [codeLanguage]);

  // OMEGA_VOICE_TOTAL_V11: la entrada escrita pasa por el mismo interprete que la voz.
  const issueText = useCallback((text: string) => {
    const instruction = routeOmegaCommand(text) || { kind:'ai_draft', text };
    window.dispatchEvent(new CustomEvent('omega:unified-command', { detail:{ instruction, via:'text' } }));
  }, []);
  const switchSafeOpen = useCallback(async (enabled: boolean) => {
    if (localhost !== true) return;
    setSafeAutoBusy(true);
    try {
      const response = await fetch('/api/omega-windows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command:'safe_auto', enabled }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Modo no permitido');
      setSafeAuto(result.autoOpenSafe === true);
      setFeedback(result.autoOpenSafe ? 'Apertura directa ACTIVADA solo para tres aplicaciones permitidas.' : 'Apertura directa desactivada.');
    } catch (e) { setFeedback(e instanceof Error ? e.message : 'No se pudo cambiar el permiso local'); }
    finally { setSafeAutoBusy(false); void refresh(); }
  }, [localhost, refresh]);

  // OMEGA_VISIBLE_WINDOWS_V08: abrir una aplicacion nativa requiere UN consentimiento en Windows.
  const windowsVoiceBusy = useRef(false);
  const openVisibleWindowsApp = useCallback(async (text: string, recipeId: string) => {
    if (windowsVoiceBusy.current) {
      setFeedback('Ya hay una accion de Windows en curso; espera al resultado.');
      return false;
    }
    if (localhost !== true) {
      setFeedback('Windows solo se controla desde esta instalacion local, no desde la web publica.');
      return false;
    }
    windowsVoiceBusy.current = true;
    setLoading(true);
    setFeedback(safeAuto ? 'Abriendo aplicación segura en Windows sin aviso adicional…' : 'Confirma la solicitud en la ventana nativa de Windows. Comprobando que la aplicacion aparezca en el escritorio...');
    try {
      const response = await fetch('/api/omega-windows', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'open', text, safeAuto }),
      });
      const result: { visible?: boolean; foreground?: boolean; windowTitle?: string; message?: string; error?: string } = await response.json();
      if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + (result.error || 'accion no completada'));
      if (result.visible !== true) throw new Error('El agente respondio, pero NO confirmo una ventana visible. Comprueba que el agente v0.8 este ejecutandose.');
      const title = result.windowTitle ? ' (' + result.windowTitle + ')' : '';
      const message = result.foreground
        ? 'Ventana abierta y visible en Windows 11' + title + '.'
        : 'Ventana detectada en Windows' + title + '. Si no aparece delante, seleccionala desde la barra de tareas.';
      setFeedback(message);
      writeLog('Ventana Windows verificada: ' + recipeId);
      addNotice('Aplicacion visible', message);
      setPlan(null);
      window.dispatchEvent(new CustomEvent('omega:voice-summary', { detail: message }));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de Windows';
      setFeedback('No se ha abierto la ventana: ' + message);
      addNotice('Ventana no confirmada', message, 'warning');
      return false;
    } finally {
      windowsVoiceBusy.current = false;
      setLoading(false);
      void refresh();
    }
  }, [localhost, addNotice, refresh, writeLog, safeAuto]);

  useEffect(() => {
    function onVoice(event: Event) {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text !== "string") return;
      setCommand(text);
      setPlannedText(text);
      const result = routeOmegaIntent(text);
      setPlan(result);
      setSection("inicio");
      if (result.status === 'matched' && result.permission === 'confirm_each' && result.intent.startsWith('open_')) {
        setFeedback('Orden reconocida. Esperando una confirmacion en Windows para abrir la aplicacion.');
        void openVisibleWindowsApp(text, result.recipeId);
      } else {
        setFeedback('Orden dictada. Revisa el plan y confirma manualmente para continuar.');
        writeLog('Orden preparada, sin ejecucion');
      }
    }
    window.addEventListener("omega:voice-order", onVoice);
    return () => window.removeEventListener("omega:voice-order", onVoice);
  }, [writeLog, openVisibleWindowsApp]);

  function prepare(text = command) {
    const result = routeOmegaIntent(text);
    setCommand(text);
    setPlannedText(text);
    setPlan(result);
    setSection("inicio");
    setFeedback(result.status === "matched" ? `Plan listo: ${result.title}. Sin ejecución todavía.` : result.reason);
    writeLog(result.status === "matched" ? `Receta ${result.recipeId} preparada` : "Orden remitida a revisión");
  }
  async function inspect() {
    if (!localhost) return;
    setLoading(true);
    setFeedback("Leyendo estado del equipo...");
    try {
      const res = await fetch("/api/omega-windows?diagnostics=1", { cache: "no-store" });
      const data: Diagnostics & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDiagnostics(data);
      setFeedback("Diagnóstico local completado, sin cambiar la configuración.");
      writeLog("Diagnóstico de solo lectura");
      addNotice("Diagnóstico terminado", "Se ha actualizado la información básica de CPU, sistema y memoria.");
    } catch (err) { setFeedback(`Diagnóstico: ${err instanceof Error ? err.message : "fallo"}`); }
    finally { setLoading(false); }
  }
  async function executePlan() {
    if (plan?.status !== "matched") return;
    if (plan.intent === "diagnose_system") { setPlan(null); await inspect(); return; }
    if (plan.permission === "browser_gesture") {
      setSection("herramientas");
      setFeedback("Abre la herramienta y autoriza desde el navegador. No se ha actuado sobre Windows.");
      setPlan(null);
      return;
    }
    if (!plan.intent.startsWith('open_') || !localhost || !connected) {
      setFeedback('Agente Windows desconectado o accion no habilitada.');
      return;
    }
    // Una sola ruta de ejecucion para voz y botones; nunca se aceptan permisos UAC automaticamente.
    await openVisibleWindowsApp(plannedText, plan.recipeId);
  }

  async function disarm() {
    setLoading(true);
    try {
      const res = await fetch("/api/omega-windows", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: "disarm" }),
      });
      const value: { message?: string; error?: string } = await res.json();
      setFeedback(res.ok ? value.message || "Autorización desactivada" : value.error || `HTTP ${res.status}`);
      writeLog("Solicitud de desautorización");
    } catch { setFeedback("No se pudo contactar con el agente."); }
    finally { setLoading(false); void refresh(); }
  }
  async function copyEditor() {
    if (!editor) { setFeedback("No hay texto que copiar."); return; }
    try { await navigator.clipboard.writeText(editor); setFeedback("Texto copiado. No se almacena su contenido."); writeLog("Texto copiado"); }
    catch { setFeedback("Permiso denegado. Usa Ctrl+C seleccionando el texto."); }
  }
  async function pasteEditor() {
    try { const text = await navigator.clipboard.readText(); setEditor(old => old + text); setFeedback("Texto pegado en el editor."); writeLog("Texto pegado"); }
    catch { setFeedback("Acceso al portapapeles denegado. Usa Ctrl+V en el editor."); }
  }
  function pointOnCanvas(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
  }
  function onSignStart(event: ReactPointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    drawingRef.current = true;
    c.setPointerCapture(event.pointerId);
    const p = pointOnCanvas(event);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#63dffb"; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 0.1, p.y + 0.1); ctx.stroke();
    setSignatureDirty(true);
  }
  function onSignMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const p = pointOnCanvas(event);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(p.x, p.y); ctx.stroke();
  }
  function clearSignature() {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setSignatureDirty(false);
    setFeedback("Firma visual borrada.");
  }
  function exportSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !signatureDirty) { setFeedback("Primero dibuja una firma."); return; }
    const a = document.createElement("a");
    a.download = "omega-firma-visual-NO-CERTIFICADA.png";
    a.href = canvas.toDataURL("image/png"); a.click();
    writeLog("Firma visual PNG exportada (no certificada)");
  }

  // OMEGA_VOICE_TOTAL_V11: todas las acciones admitidas reutilizan los mismos handlers que los botones.
  useEffect(() => {
    const onOmega = (event: Event) => {
      const detail = (event as CustomEvent<{instruction:OmegaCommand;via:'voice'|'text'}>).detail;
      if (!detail?.instruction || !['voice','text'].includes(detail.via)) return;
      const action = detail.instruction;
      const say = (message: string) => {
        setFeedback(message); setAvMessage(message);
        if (detail.via === 'voice') window.dispatchEvent(new CustomEvent('omega:voice-summary', {detail:message.slice(0,155)}));
      };
      switch (action.kind) {
        case 'navigate':
          if (navigation.some(n => n.id === action.section)) { setSection(action.section as Section); say('Sección abierta: '+action.label); } else { setSection('inicio'); say('Sección no disponible; abriendo Inicio.'); } return;
        case 'navigate_step': {
          const index = navigation.findIndex(n => n.id === section);
          const next = navigation[(index + action.step + navigation.length) % navigation.length];
          setSection(next.id); say('Sección abierta: '+next.label); return;
        }
        case 'ideas_show':
          setSection('conocimiento');say('Mostrando las ideas guardadas en este navegador.');return;
        case 'idea_save':
          saveIdea(action.text);say('Idea guardada en Conocimiento.');return;
        case 'windows_open': {
          const plan = routeOmegaIntent(action.text);
          if (plan.status === 'matched' && plan.intent.startsWith('open_') && plan.permission === 'confirm_each') {
            setSection('acciones');setPlan(plan);setPlannedText(action.text);
            void openVisibleWindowsApp(action.text,plan.recipeId);
          } else say('Solo puedo abrir Calculadora, Bloc de notas y Explorador con este agente.');
          return;
        }
        case 'unsupported_app':
          setSection('acciones');say('Esta aplicación no está autorizada por el agente. Disponibles: Calculadora, Bloc de notas y Explorador.');return;
        case 'windows_diagnostic':
          setSection('inicio');void inspect();say('Consultando el diagnóstico del equipo...');return;
        case 'agent_status':
          setSection('ajustes');void refresh();say('Comprobando el agente Windows local.');return;
        case 'agent_disarm':
          setSection('ajustes');void disarm();say('Solicitando desautorizar el agente local.');return;
        case 'market_status':
          setSection('inicio');say('IA avanzada de pago retirada. Usa las órdenes locales de OMEGA.');return;
        case 'safe_auto_info':
          say('Por seguridad, activa o desactiva apertura segura desde el control de accesibilidad. No se modifica por voz.');return;
        case 'code_prepare':
          setSection('codigo');setCodePrompt(action.text);setGeneratedCode('');
          if (action.language) setCodeLanguage(action.language);
          setCodeMessage('Petición dictada. Puedes revisarla y editarla; no se enviará a una IA de pago.');
          say('Petición de código preparada sin consumir créditos.');return;
        case 'code_language':
          setCodeLanguage(action.language);setSection('codigo');say('Lenguaje seleccionado: '+action.language);return;
        case 'code_clear':
          setSection('codigo');setGeneratedCode('');setCodePrompt('');setCodeMessage('Editor de código limpio.');say('Editor de código limpio.');return;
        case 'code_copy':
          setSection('codigo');
          if (!generatedCode) {say('No hay código generado para copiar.');return;}
          void navigator.clipboard.writeText(generatedCode).then(()=>say('Código copiado.'),()=>say('El navegador exige permiso para copiar. Pulsa Copiar código.'));return;
        case 'code_download':
          setSection('codigo');say('Pulsa Descargar archivo en el editor de código. El navegador necesita tu gesto para guardar.');return;
        case 'editor_append':
          setSection('herramientas');setEditor(old => old + (old && !/\s$/.test(old) ? ' ' : '') + action.text);
          say('Texto añadido al editor.');return;
        case 'editor_dictate':
          setSection('herramientas');onDictateEditor();return;
        case 'editor_clear':
          setSection('herramientas');setEditor('');say('Editor de texto limpio.');return;
        case 'editor_copy':
          setSection('herramientas');void copyEditor();return;
        case 'editor_paste':
          setSection('herramientas');void pasteEditor();return;
        case 'notices_read':
          setSection('avisos');setNotices(old => old.map(n => n.kind === 'info' ? {...n,read:true} : n));
          say('Avisos informativos internos marcados como leídos. Los importantes no se han aceptado.');return;
        case 'notices_auto':
          setSection('avisos');setInfoAutoRead(action.value);
          if(action.value) setNotices(old => old.map(n => n.kind === 'info' ? {...n,read:true} : n));
          say(action.value?'Lectura automática solo para avisos informativos.':'Lectura automática desactivada.');return;
        case 'theme':
          window.dispatchEvent(new CustomEvent('omega:accessibility',{detail:action}));
          say('Paleta visual actualizada.');return;
        case 'accessibility':
          window.dispatchEvent(new CustomEvent('omega:accessibility',{detail:action}));
          say('Accesibilidad actualizada.');return;
        case 'signature_clear':
          setSection('herramientas');clearSignature();say('Firma visual borrada.');return;
        case 'signature_export':
          setSection('herramientas');say('Pulsa Guardar PNG para confirmar la descarga de tu firma visual.');return;
        case 'voice_start':
          if(!conversationEnabled) onToggleConversation();
          say('Escucha activada. El micrófono puede pedir permiso.');return;
        case 'code_dictate':
          setSection('codigo');onDictateCode();return;
        case 'camera_info':
          say('La cámara se controla desde los permisos del navegador. Revisa su estado en el panel derecho.');return;
        case 'account_info':
          setSection('cuenta');say('Abriendo cuenta. Las contraseñas y los pagos se escriben y confirman personalmente.');return;
        case 'voice_stop':
          if(conversationEnabled) onToggleConversation();
          say('Escucha continua detenida. Puedes seguir escribiendo.');return;
        case 'ai_draft':
          setSection('inicio');setCommand(action.text);setPlannedText(action.text);setPlan(routeOmegaIntent(action.text));
          say('Orden preparada para revisión local. No se han consumido créditos.');return;
        case 'restricted':
          say(action.reason);return;
        case 'help':
          setSection('acciones');window.dispatchEvent(new Event('omega:voice-show-help'));say('Comandos: '+OMEGA_VOICE_EXAMPLES.slice(0,8).join('; ')+'. Otros: editor, avisos, accesibilidad y código.');return;
      }
    };
    window.addEventListener('omega:unified-command',onOmega);
    return () => window.removeEventListener('omega:unified-command',onOmega);
  }, [section,saveIdea,openVisibleWindowsApp,refresh,onDictateEditor,onDictateCode,conversationEnabled,onToggleConversation,generatedCode]);

  return (
    <div className="ou-wrap">
      <header className="ou-topline">
        <div className="ou-brand"><div className="ou-mark">Ω</div><div><strong>OMEGA <span>UNIFIED</span></strong><small>HOLOGRAMA.ES / VOZ Y TEXTO / v1.1</small></div></div>
        {/* OMEGA_CENTRAL_MENU_FALLBACK_V1: navegacion secundaria accesible, reversible */}
        <label className="ou-central-jump" htmlFor="ou-central-jump">IR A SECCION
          <select id="ou-central-jump" aria-label="Ir a una seccion de OMEGA" value={section} onChange={e => setSection(e.target.value as Section)}>
            {navigation.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <div className="ou-topstate"><span className={connected ? "ou-light" : "ou-light ou-light-off"}/>{connected ? "AGENTE CONECTADO" : localhost === null ? "COMPROBANDO AGENTE" : localhost ? agentStatus?.error || "COMPROBANDO AGENTE" : "WEB PÚBLICA · MODO SEGURO"}</div>
      </header>
      <OmegaV09CommandStrip onCommand={issueText} onTalk={onToggleConversation} speaking={isSpeaking} listening={micStatus === "listening"} busy={isProcessing || codeBusy || loading} safeAuto={safeAuto} safeAutoBusy={safeAutoBusy} localAvailable={connected && localhost === true} onSafeAuto={switchSafeOpen}/>
      <div className="ou-av-ribbon" role="status" aria-live="polite">
        <span className={`ou-mini-hologram ou-av-orb ${isSpeaking ? "ou-mini-speaking" : micStatus === "listening" ? "ou-mini-listening" : isProcessing || codeBusy ? "ou-mini-working" : ""}`} aria-hidden="true">Ω</span>
        <div className="ou-av-lines">
          <strong>{isSpeaking ? "OMEGA está hablando" : micStatus === "listening" ? "Escuchando tu voz" : isProcessing || codeBusy ? "Procesando tu petición" : "Centro audiovisual conectado"}</strong>
          <p>{liveTranscript ? `Escuchando: ${liveTranscript}` : lastUserVoice ? `Has dicho: ${lastUserVoice}` : "Voz o texto: «abre calculadora», «escribe en el editor ...», «alto contraste» o «ayuda»"}</p>
          <p className="ou-av-result">{avMessage || feedback}</p>
        </div>
        <button type="button" className="ou-secondary ou-av-talk" disabled={micStatus === "unsupported"} onClick={onToggleConversation}>{conversationEnabled ? <MicOff size={15}/> : <Mic size={15}/>} {conversationEnabled ? "Parar" : "Hablar"}</button>
      </div>
      <div className="ou-shell">
        <nav className="ou-nav" aria-label="Menú principal OMEGA">
          <div className="ou-nav-label">CENTRO DE MANDO</div>
          {navigation.map(item => {
            const Icon = item.icon;
            return <button key={item.id} type="button" aria-current={section === item.id ? "page" : undefined}
              className={section === item.id ? "ou-nav-button ou-selected" : "ou-nav-button"} onClick={() => setSection(item.id)}>
              <Icon size={17}/><span>{item.label}</span>{item.id === "avisos" && pendingNotices > 0 && <em>{pendingNotices}</em>}
            </button>;
          })}
          <div className="ou-nav-foot"><ShieldCheck size={17}/><p>Permisos por acción. UAC siempre humano.</p></div>
        </nav>
        <div className="ou-main">
          <div className="ou-mainhead"><div><p className="ou-kicker">OPERADOR WINDOWS / CONSOLA CENTRAL</p><h1>{navigation.find(n => n.id === section)?.label}</h1></div><div className="ou-version">256D <span>·</span> v1.1</div></div>
          {section === "cuenta" && <OmegaV09Account/>}
          {section === "inicio" && <>
            <section className="ou-intro"><div><span className="ou-eyebrow">NÚCLEO HOLOGRÁFICO</span><h2>Tu PC, desde un único centro de mando.</h2><p>Describe qué necesitas. OMEGA busca primero una receta local y solo prepara acciones autorizadas.</p></div><div className="ou-intro-decor">Ω</div></section>
            <form className="ou-command-form" onSubmit={event => { event.preventDefault(); issueText(command); }}>
              <label htmlFor="ou-command">ORDEN PARA WINDOWS</label>
              <div className="ou-command-row"><span className={`ou-mini-hologram ${isSpeaking ? "ou-mini-speaking" : micStatus === "listening" ? "ou-mini-listening" : loading ? "ou-mini-working" : ""}`} title="OMEGA responde a la voz" aria-hidden="true">Ω</span><Terminal size={18}/><input id="ou-command" maxLength={180} value={command} onChange={event => { setCommand(event.target.value); setPlan(null); }} placeholder="Ej.: abre calculadora"/><button type="button" className="ou-icon-action" aria-label="Dictar orden" title="Dictado, sin ejecutar" onClick={onDictateWindows}><Mic size={18}/></button><button type="submit" className="ou-primary" disabled={!command.trim() || loading}>Enviar orden <ChevronRight size={17}/></button></div>
            </form>
            <div className="ou-quick">{quick.map(q => <button key={q.text} type="button" onClick={() => issueText(q.text)}><WandSparkles size={15}/><span>{q.text}</span></button>)}</div>
            {plan && <section className="ou-plan" aria-live="polite"><div className="ou-flex-between"><strong>{plan.status === "matched" ? plan.title : "Revisión necesaria"}</strong><span className="ou-chip">{plan.status === "matched" ? plan.recipeId : plan.status}</span></div><p>{plan.status === "matched" ? plan.detail : plan.reason}</p>{plan.status === "matched" && <p className="ou-plan-text">Orden preparada: <code>{plannedText}</code></p>}<div className="ou-actions"><button type="button" className="ou-primary" disabled={loading || (plan.status === "matched" && plan.permission === "confirm_each" && !connected)} onClick={() => void executePlan()}>{plan.status === "matched" ? plan.permission === "confirm_each" ? "Solicitar acción" : "Continuar" : "No ejecutable"}</button><button type="button" className="ou-secondary" onClick={() => setPlan(null)}>Cancelar</button></div></section>}
            <div className="ou-feature-grid">
              <div className="ou-feature"><div className="ou-feature-head"><Activity size={17}/><strong>Estado del sistema</strong></div><p>{connected ? `${agentStatus?.agent} ${agentStatus?.version}` : agentStatus?.error || "Comprobando..."}</p><button className="ou-text-button" onClick={() => void refresh()} type="button"><RefreshCw size={15}/> Actualizar estado</button></div>
              <div className="ou-feature"><div className="ou-feature-head"><Monitor size={17}/><strong>Visión y gestos</strong></div><p>{cameraStatus === "active" ? handDetected ? isGrabbing ? "Gesto de pinza detectado" : "Mano detectada" : "Cámara activa; lista para gestos" : cameraStatus === "connecting" ? "Iniciando cámara existente" : "Permite acceso a la cámara"}</p><p>El holograma y la cámara siguen trabajando en todas las secciones.</p></div>
            </div>
          </>}
          {section === "acciones" && <section className="ou-section"><h2>Acciones rápidas verificables</h2><p>Las órdenes usan el intérprete único. Windows solicitará consentimiento cuando corresponda.</p><div className="ou-row-list">{quick.map(q => <div className="ou-list-row" key={q.text}><div><strong>{q.text}</strong><p>{q.description}</p></div><button type="button" className="ou-secondary" onClick={() => issueText(q.text)}>Preparar <ChevronRight size={14}/></button></div>)}</div><button type="button" className="ou-secondary" disabled={loading} onClick={() => void disarm()}><ShieldAlert size={15}/> Desautorizar agente</button></section>}
          {section === "codigo" && <section className="ou-section ou-code-section">
            <div className="ou-code-title"><div><h2>Programar por voz</h2><p>Di «programa un script que…» o pulsa el micrófono y dicta directamente. El dictado prepara texto sin gastar créditos.</p></div><span className={`ou-mini-hologram ou-code-companion ${isSpeaking ? "ou-mini-speaking" : micStatus === "listening" ? "ou-mini-listening" : codeBusy ? "ou-mini-working" : ""}`} aria-hidden="true">Ω</span></div>
            <div className="ou-code-toolbar">
              <label htmlFor="ou-code-language">Lenguaje<select id="ou-code-language" value={codeLanguage} onChange={e => setCodeLanguage(e.target.value)} disabled={codeBusy}><option value="powershell">PowerShell · Windows</option><option value="typescript">TypeScript</option><option value="javascript">JavaScript</option><option value="python">Python</option><option value="batch">CMD / .bat</option></select></label>
              <p className="ou-small">Dictado local: no se utiliza OpenRouter ni el mercado de créditos.</p>
            </div>
            <label className="ou-field-label" htmlFor="ou-code-instruction">DÍCTALE QUÉ QUIERES PROGRAMAR</label>
            <div className="ou-code-instruction"><textarea id="ou-code-instruction" rows={3} maxLength={1500} value={codePrompt} onChange={e => setCodePrompt(e.target.value)} placeholder="Ejemplo: crea un script PowerShell que liste mis archivos grandes y permita exportarlos a CSV, sin borrar nada."/><button type="button" className="ou-primary" onClick={onDictateCode} disabled={micStatus === "unsupported" || codeBusy}><Mic size={16}/> Dictar código</button></div>
            <div className="ou-actions"><button type="button" className="ou-primary" disabled={true} title="La generación automática local requiere configurar un motor local verificado" onClick={() => {}}><Code2 size={16}/>Generación automática no configurada</button><button type="button" className="ou-secondary" disabled={codeBusy} onClick={() => { setGeneratedCode(""); setCodePrompt(""); setCodeMessage("Editor limpio. Esperando nueva petición."); }}>Limpiar</button></div>
            <p className="ou-small">Puedes dictar y editar la petición sin créditos. La generación automática estará disponible cuando se configure y verifique un motor local.</p>
            <div className="ou-code-output" aria-live="polite"><div className="ou-code-header"><div><span className={`ou-mini-hologram ou-code-tiny ${isSpeaking ? "ou-mini-speaking" : micStatus === "listening" ? "ou-mini-listening" : codeBusy ? "ou-mini-working" : ""}`} aria-hidden="true">Ω</span><strong>{codeBusy ? "OMEGA está escribiendo…" : "Código generado"}</strong><small>{codeEngineLabel}</small></div><span className="ou-chip">{codeLanguage.toUpperCase()} · SOLO REVISIÓN</span></div><p className="ou-code-message" role="status">{codeMessage}</p><textarea className="ou-code-editor" aria-label="Editor de código editable" spellCheck={false} value={generatedCode} onChange={e => setGeneratedCode(e.target.value)} rows={13} placeholder="El código creado aparecerá aquí. Puedes corregirlo antes de copiarlo o descargarlo."/>
              <div className="ou-actions"><button className="ou-secondary" type="button" disabled={!generatedCode} onClick={async () => { try { await navigator.clipboard.writeText(generatedCode); setCodeMessage("Código copiado. No se ha ejecutado."); } catch { setCodeMessage("Portapapeles bloqueado: selecciona el texto y pulsa Ctrl+C."); } }}><ClipboardCopy size={16}/> Copiar código</button><button className="ou-secondary" type="button" disabled={!generatedCode} onClick={() => { const extension: Record<string,string> = { powershell:"ps1", typescript:"ts", javascript:"js", python:"py", batch:"bat" }; const file = new Blob([generatedCode], { type:"text/plain;charset=utf-8" }); const url = URL.createObjectURL(file); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `omega-propuesta.${extension[codeLanguage] || "txt"}`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); setCodeMessage("Código descargado, no ejecutado. Revísalo antes de utilizarlo."); }}><Download size={16}/> Descargar archivo</button></div>
            </div>
            <p className="ou-small">Por seguridad, el dictado no ejecuta PowerShell, CMD ni código automáticamente ni acepta avisos UAC. Esta pantalla no realiza consultas a OpenRouter.</p>
          </section>}
          {section === "avisos" && <section className="ou-section"><h2>Centro de avisos y decisiones</h2><p>Solo se pueden marcar automáticamente como leídos los avisos informativos internos. Los permisos UAC, pagos y credenciales siempre dependen de ti.</p><label className="ou-check"><input type="checkbox" checked={infoAutoRead} onChange={event => { setInfoAutoRead(event.target.checked); if (event.target.checked) setNotices(old => old.map(n => n.kind === "info" ? {...n,read:true} : n)); }}/><span>Marcar leídos los próximos avisos <b>informativos internos</b> de esta sesión</span></label><div className="ou-row-list">{notices.map(n => <div className="ou-list-row" key={n.id}><div><span className="ou-chip">{n.kind === "warning" ? "Revisión humana" : "Informativo"} · {n.read ? "Leído" : "Pendiente"}</span><strong>{n.title}</strong><p>{n.detail}</p></div>{n.kind === "info" && !n.read && <button type="button" className="ou-secondary" onClick={() => setNotices(old => old.map(x => x.id === n.id ? { ...x, read:true } : x))}>Marcar leído</button>}</div>)}</div></section>}
          {section === "herramientas" && <section className="ou-section"><h2>Herramientas esenciales</h2><p>Copiar, pegar, escribir y firmar visualmente desde tu navegador. Ninguna de estas herramientas controla ventanas externas.</p><label className="ou-field-label" htmlFor="ou-editor">EDITOR DE TEXTO</label><textarea id="ou-editor" value={editor} onChange={e => setEditor(e.target.value)} placeholder="Escribe aquí o pega texto…" rows={5}/><div className="ou-actions"><button type="button" className="ou-secondary" onClick={() => void copyEditor()}><ClipboardCopy size={16}/> Copiar</button><button type="button" className="ou-secondary" onClick={() => void pasteEditor()}><ClipboardPaste size={16}/> Pegar</button><button type="button" className="ou-secondary" onClick={onDictateEditor}><Mic size={16}/> Dictar texto</button><button type="button" className="ou-secondary" onClick={() => setEditor("")}><Trash2 size={16}/> Vaciar</button></div><div className="ou-divider"/><div className="ou-feature-head"><FileSignature size={18}/><h3>Firma visual</h3></div><p>Dibuja con el ratón o el dedo. El PNG resultante <strong>no es una firma electrónica certificada</strong>.</p><canvas ref={canvasRef} width={960} height={260} className="ou-signature" aria-label="Lienzo para dibujar una firma visual" onPointerDown={onSignStart} onPointerMove={onSignMove} onPointerUp={() => { drawingRef.current = false; }} onPointerCancel={() => { drawingRef.current = false; }}/><div className="ou-actions"><button className="ou-secondary" type="button" onClick={clearSignature}><Trash2 size={16}/> Borrar</button><button className="ou-primary" type="button" onClick={exportSignature} disabled={!signatureDirty}><Download size={16}/> Guardar PNG</button></div></section>}
          {section === "conocimiento" && <section className="ou-section"><h2>Biblioteca de capacidades Windows</h2><p><b>{catalogue.recipes.length} recetas documentadas.</b> No significa que todas estén implementadas. Las órdenes conocidas se clasifican localmente sin esperar a una IA remota.</p><div className="ou-ideas">
                <strong>Mis ideas · {ideas.length} guardadas en este navegador</strong>
                <p>Se mantienen al cambiar de menú o recargar. En otro dispositivo o dominio tendrás una lista diferente.</p>
                <form onSubmit={e => { e.preventDefault(); saveIdea(ideaDraft); }}>
                  <textarea rows={2} value={ideaDraft} maxLength={600} onChange={e => setIdeaDraft(e.target.value)} placeholder="Escribe tu idea, o di «guarda idea ...» con el micrófono activo"/>
                  <button type="submit" className="ou-primary" disabled={!ideaDraft.trim()}>Guardar idea</button>
                </form>
                {ideas.length ? <div className="ou-row-list">{ideas.map((idea, i) => <div key={i} className="ou-list-row"><p>{idea}</p><button type="button" className="ou-secondary" onClick={() => setIdeas(old => old.filter((_, j) => j !== i))}>Eliminar</button></div>)}</div> : <p>Aún no hay ideas guardadas.</p>}
              </div><div className="ou-row-list">{catalogue.recipes.map(r => { const available = ["APP-CALC-01","APP-NOTE-02","APP-EXP-03","SYS-READ-01","CLIP-10","CLIP-11","VOICE-12","SIGN-VIS-13","NOTICE-INFO-15"].includes(r.id); return <div className="ou-list-row" key={r.id}><div><span className="ou-chip">{r.id} · {r.risk}</span><strong>{r.intent.replaceAll("_", " ")}</strong><p>{r.permission} · {r.windows}</p></div><span className={available ? "ou-tag-ready" : "ou-tag-pending"}>{available ? "Disponible*" : "En estudio"}</span></div>; })}</div><p className="ou-small">*Disponible solo dentro de su ámbito: las aperturas necesitan consentimiento Windows; el portapapeles y la voz requieren permisos del navegador; los avisos informativos solo pertenecen a OMEGA.</p></section>}
          {section === "ajustes" && <section className="ou-section"><h2>Seguridad y configuración</h2><div className="ou-row-list"><div className="ou-list-row"><div><strong>Agente de Windows</strong><p>{connected ? "Conectado por 127.0.0.1:8766 · token en servidor" : agentStatus?.error || "Sin información"}</p></div><button className="ou-secondary" type="button" onClick={() => void refresh()}><RefreshCw size={15}/> Revisar</button></div><div className="ou-list-row"><div><strong>Confirmación por acción</strong><p>Obligatoria. No se automatizan UAC, firmas legales ni cambios críticos.</p></div><ShieldCheck size={20}/></div><div className="ou-list-row"><div><strong>Micrófono y gestos</strong><p>Se utiliza el sistema de voz y cámara ya existente, sin segunda instancia.</p></div><span className="ou-chip">{micStatus}</span></div><div className="ou-list-row"><div><strong>Acceso remoto</strong><p>Bloqueado. La ruta Windows solo opera en desarrollo local.</p></div><ShieldAlert size={20}/></div></div><button className="ou-secondary" disabled={loading} type="button" onClick={() => void disarm()}><Square size={16}/> Desautorizar ahora</button></section>}
        </div>
        <aside className="ou-right"><div className="ou-right-header"><span>ESTADO EN TIEMPO REAL</span><Activity size={17}/></div><div className="ou-stat"><small>VISIÓN HOLOGRÁFICA</small><div className="ou-camera"><video autoPlay playsInline muted ref={videoRef}/><span>{cameraStatus === "active" ? handDetected ? isGrabbing ? "GESTO CAPTURADO" : "MANO DETECTADA" : "CÁMARA ACTIVA" : cameraStatus === "connecting" ? "CONECTANDO..." : "SIN CÁMARA"}</span></div></div><div className="ou-stat"><small>AGENTE WINDOWS</small><strong className={connected ? "ou-good" : "ou-warn"}>{connected ? "CONECTADO" : "SIN CONEXIÓN"}</strong><p>{agentStatus?.version ? `Versión ${agentStatus.version}` : agentStatus?.error || "Consultando..."}</p></div><div className="ou-stat" data-omega-voz-sin-creditos="v9"><small>ENTRADA DE VOZ</small><strong>{micStatus === "listening" ? "ESCUCHANDO" : "LISTA PARA DICTAR"}</strong><div className="ou-actions"><button className="ou-secondary" type="button" disabled={micStatus === "unsupported"} onClick={onDictateWindows}><Mic size={15}/> Dictar orden</button></div>{liveTranscript && <p>{liveTranscript}</p>}<p className="ou-small">Dictado sin créditos. Las acciones Windows conservan su confirmación.</p></div><div className="ou-stat"><small>ACTIVIDAD RECIENTE</small>{log.length ? log.slice(0,5).map((item,i) => <p key={i}>· {item}</p>) : <p>Sin operaciones registradas todavía.</p>}</div></aside>
      </div>
      <div className="ou-statusbar"><div><span className="ou-light"/> {feedback}</div><span>OMEGA v1.1 · VOZ + TEXTO · ACCIONES LOCALES SIN COSTE</span></div>
      {diagnostics && <section className="ou-diag" aria-label="Diagnóstico del equipo"><div><Info size={18}/><strong>Diagnóstico Windows</strong></div><p>{diagnostics.system} · {diagnostics.osVersion} · {diagnostics.architecture} · Kernel {diagnostics.kernel}</p><p>CPU: {diagnostics.logicalProcessors} hilos · RAM: {diagnostics.availableRamGB} GB disponibles / {diagnostics.ramGB} GB totales</p><button className="ou-secondary" onClick={() => setDiagnostics(null)} type="button">Cerrar diagnóstico</button></section>}
    </div>
  );
}
