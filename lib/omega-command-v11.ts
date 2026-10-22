/**
 * OMEGA_VOICE_TOTAL_V11 / OMEGA VOZ TOTAL v1.1. Intérprete LOCAL y determinista para voz y teclado.
 * No consulta servicios, no usa credenciales y NO ejecuta acciones por sí mismo.
 * Solo reconoce capacidades que existen en la interfaz instalada.
 */
export type OmegaSection = "cuenta" | "inicio" | "acciones" | "codigo" | "avisos" | "herramientas" | "conocimiento" | "ia-avanzada" | "ajustes";
export type OmegaCommand =
  | { kind: "navigate"; section: OmegaSection; label: string }
  | { kind: "navigate_step"; step: 1 | -1 }
  | { kind: "idea_save"; text: string }
  | { kind: "ideas_show" }
  | { kind: "windows_open"; text: string }
  | { kind: "windows_diagnostic" }
  | { kind: "unsupported_app"; text: string }
  | { kind: "code_prepare"; text: string; language?: string }
  | { kind: "code_language"; language: string }
  | { kind: "code_clear" }
  | { kind: "code_copy" }
  | { kind: "code_download" }
  | { kind: "editor_append"; text: string }
  | { kind: "editor_clear" }
  | { kind: "editor_copy" }
  | { kind: "editor_paste" }
  | { kind: "editor_dictate" }
  | { kind: "notices_read" }
  | { kind: "notices_auto"; value: boolean }
  | { kind: "theme"; theme: "noche" | "claro" | "contraste" | "ambar" | "azul" | "daltonismo" }
  | { kind: "accessibility"; feature: "large" | "reduced-motion" | "wakeword"; value: boolean }
  | { kind: "safe_auto_info" }
  | { kind: "agent_disarm" }
  | { kind: "agent_status" }
  | { kind: "market_status" }
  | { kind: "ai_draft"; text: string }
  | { kind: "signature_clear" }
  | { kind: "signature_export" }
  | { kind: "voice_stop" }
  | { kind: "voice_start" }
  | { kind: "code_dictate" }
  | { kind: "account_info" }
  | { kind: "camera_info" }
  | { kind: "help" }
  | { kind: "restricted"; reason: string };

export function simplifyOmegaVoice(raw: string): string {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/^[\s¿¡!?.,:;]+|[\s¿¡!?.,:;]+$/g, "")
    .replace(/^(?:oye\s+)?omega(?:\s+|[,.:;]+\s*)/, "")
    .replace(/\s+/g, " ").trim();
}

const sections: { id: OmegaSection; label: string; expressions: string[] }[] = [
  { id:"inicio", label:"Inicio", expressions:["inicio","home","principal","pagina principal","pantalla principal"] },
  { id:"cuenta", label:"Cuenta y planes", expressions:["cuenta","mi cuenta","cuenta y planes","iniciar sesion","inicia sesion","registrarme","registro","crear cuenta","registrar cuenta","suscripcion","suscripciones","planes","planes anuales","mi perfil","perfil","mis datos"] },
  { id:"acciones", label:"Acciones", expressions:["acciones","ordenes","comandos","acciones rapidas","control windows"] },
  { id:"codigo", label:"Código por voz", expressions:["codigo","codigo por voz","programacion","programar","editor de codigo","ventana de codigo"] },
  { id:"avisos", label:"Avisos", expressions:["avisos","notificaciones","alertas","centro de avisos"] },
  { id:"herramientas", label:"Herramientas", expressions:["herramientas","editor de texto","texto","copiar y pegar","portapapeles"] },
  { id:"conocimiento", label:"Conocimiento", expressions:["conocimiento","biblioteca","mis ideas","ideas","recetas","biblioteca windows"] },
  { id:"ia-avanzada", label:"IA avanzada", expressions:["ia avanzada","inteligencia artificial","ia","consulta a omega","mercado de ia","mercado","asistente","modelos"] },
  { id:"ajustes", label:"Ajustes", expressions:["ajustes","configuracion","preferencias","opciones","seguridad"] },
];
const navigationIntro = /^(?:(?:ir|ve|ves|vuelve|volver|regresa|regresar|vamos|entra|entrar|abre|abrir|muestra|mostrar|muestrame|cambia|cambiar|selecciona|seleccionar|lleva|llevame|navega|navegar)(?:\s+(?:a|al|a la|en|el|la|los|las|de|del|menu|seccion|apartado|pantalla))*\s+)?/;
function findNavigation(value: string): { id: OmegaSection; label: string } | null {
  const explicit = /^(?:ir|ve|ves|vuelve|volver|regresa|regresar|vamos|entra|entrar|abre|abrir|muestra|mostrar|muestrame|cambia|cambiar|selecciona|seleccionar|lleva|llevame|navega|navegar)\b/.test(value);
  const cleaned = value.replace(navigationIntro, "")
    .replace(/^(?:menu|seccion|apartado|pantalla)(?:\s+(?:de|del|la|el))?\s+/, "")
    .replace(/^(?:a|al|la|el|de|del)\s+/, "").trim();
  const match = sections.find(s => s.expressions.includes(cleaned));
  if (match && (explicit || value === cleaned || /^(?:menu|seccion|apartado)\b/.test(value))) return match;
  return null;
}
function languageFor(text: string): string | undefined {
  if (/\b(?:power\s?shell|powershel)\b/.test(text)) return "powershell";
  if (/\btypescript\b/.test(text)) return "typescript";
  if (/\bjavascript\b/.test(text)) return "javascript";
  if (/\bpython\b/.test(text)) return "python";
  if (/\b(?:cmd|batch|\.bat)\b/.test(text)) return "batch";
  return undefined;
}

/** Devuelve null para una conversación libre: nunca inventa capacidades de Windows. */
export function routeOmegaCommand(raw: string): OmegaCommand | null {
  if (typeof raw !== "string" || raw.length > 3000 || !raw.trim()) return null;
  const text = raw.trim();
  const s = simplifyOmegaVoice(text);
  if (!s) return null;

  // Prohibición antes de cualquier parser permisivo. Nunca confirmar pagos, UAC, contraseñas o firmas.
  if (/\b(?:acepta|aceptar|autoriza|autorizar|confirma|confirmar|aprueba|aprobar|pulsa|pulsar)\b.*\b(?:uac|administrador|pago|compra|transferencia|suscripcion|contrase[nñ]a|clave|firma legal|firma electronica|permiso critico)\b/.test(s))
    return { kind:"restricted", reason:"No puedo aceptar por voz permisos de administrador, pagos, contraseñas ni firmas legales. Debes confirmarlos personalmente." };
  if (/\b(?:borra|borra todo|formatea|formatear|elimina)\b.*\b(?:disco|sistema|windows|archivos del sistema)\b/.test(s))
    return { kind:"restricted", reason:"Esa operación del sistema no está implementada ni autorizada." };

  if (/^(?:ayuda|lista (?:de )?comandos|que (?:puedes|sabes) hacer|que comandos (?:hay|tienes)|muestra (?:los )?comandos|comandos disponibles)$/.test(s)) return {kind:"help"};
  if (/^(?:siguiente|siguiente menu|siguiente seccion|avanza un menu)$/.test(s)) return {kind:"navigate_step",step:1};
  if (/^(?:anterior|menu anterior|seccion anterior|retrocede un menu)$/.test(s)) return {kind:"navigate_step",step:-1};

  // Las operaciones específicas prevalecen frente a las palabras de los menús.
  const idea = text.match(/^\s*(?:(?:oye\s+)?omega[\s,:;.!-]+)?(?:guarda|guardar|anota|apunta|recuerda|almacena)\s+(?:(?:la|una)\s+)?idea\s*(?:de|que|:)?\s+(.+)$/i);
  if (idea && idea[1] && idea[1].trim().length >= 3) return {kind:"idea_save",text:idea[1].trim().slice(0,600)};
  if (/^(?:muestra|mostrar|ver|abre|abrir|lee|listar|lista)\s+(?:mis\s+)?ideas$/.test(s)) return {kind:"ideas_show"};

  if (/^(?:crear cuenta|registrar cuenta|registro de usuario|cerrar sesion|cierra sesion)$/.test(s)) return {kind:"account_info"};
  if (/^(?:activa|activar|abre|abrir|encender|enciende|revisa|comprobar)\s+(?:la\s+)?camara$/.test(s)) return {kind:"camera_info"};
  if (/^(?:diagnostico(?: de)? windows|diagnostico del (?:pc|sistema|equipo)|diagnostica (?:mi )?(?:pc|equipo|windows)|revisa (?:mi )?(?:pc|equipo|sistema)|estado del equipo|estado de windows|cuanta (?:ram|memoria) tengo)$/.test(s)) return {kind:"windows_diagnostic"};
  if (/^(?:estado (?:del|de) agente|estado de windows agent|(?:actualiza|revisa|comprueba|muestra|ver)\s+(?:el\s+)?(?:estado\s+de\s+)?(?:agente|windows agent|agente windows))$/.test(s)) return {kind:"agent_status"};
  if (/^(?:estado (?:de|del) (?:openrouter|mercado|ia avanzada)|(?:actualiza|revisa|comprueba|muestra|ver)\s+(?:el\s+)?(?:estado\s+de\s+)?(?:openrouter|ia avanzada|mercado ia|mercado de ia|consumo|saldo|creditos))$/.test(s)) return {kind:"market_status"};
  if (/^(?:desautoriza|desarmar|desarma|deten|detener|desactivar)\s+(?:el\s+)?agente(?:\s+windows)?$/.test(s)) return {kind:"agent_disarm"};
  if (/^(?:activa|activar|desactiva|desactivar)\s+(?:el\s+)?(?:modo\s+)?(?:apertura automatica|apertura segura|autoclic|autoabrir)$/.test(s)) return {kind:"safe_auto_info"};
  if (/^(?:(?:abre|abrir|inicia|iniciar|ejecuta|ejecutar|muestra)\s+(?:la\s+|el\s+|la aplicacion\s+|el programa\s+)?)?(?:calculadora|calc(?:\.exe)?|bloc de notas|block de notas|notepad(?:\.exe)?|explorador(?: de archivos)?|explorer(?:\.exe)?)$/.test(s)) {
    if (/^(?:calculadora|calc|bloc|block|notepad|explorador|explorer)/.test(s)) return null; // no abrir por una palabra suelta
    return {kind:"windows_open",text};
  }

  if (/^(?:marca|marcar|lee|leer|limpia|limpiar)\s+(?:como\s+)?(?:leidos?\s+)?(?:los\s+)?(?:avisos|notificaciones)(?:\s+(?:informativos|internos|como leidos))?$/.test(s) || /^(?:marca|marcar) (?:todos )?los avisos como leidos$/.test(s)) return {kind:"notices_read"};
  if (/^(?:activa|activar|desactiva|desactivar)\s+(?:la\s+)?(?:lectura automatica|autoleer|avisos informativos automaticos)$/.test(s)) return {kind:"notices_auto",value:/^activa/.test(s)};

  if (/^(?:escribe|escribir|anade|añade|agrega|agregar|dicta|dictar)\s+(?:(?:en|al|a)\s+)?(?:el\s+)?(?:editor(?: de texto)?|texto|bloc de texto)\s*[:,-]?\s+/.test(s)) {
    const m=text.match(/^\s*(?:escribe|escribir|a[nñ]ade|agrega|agregar|dicta|dictar)\s+(?:(?:en|al|a)\s+)?(?:el\s+)?(?:editor(?: de texto)?|texto|bloc de texto)\s*[:,-]?\s+(.+)$/i);
    if (m?.[1]) return {kind:"editor_append",text:m[1].trim().slice(0,1500)};
  }
  if (/^(?:dicta|dictar|activar dictado|dictado)\s+(?:de\s+|el\s+|por\s+)?(?:codigo|programacion)$/.test(s)) return {kind:"code_dictate"};
  if (/^(?:dicta|dictar|activar dictado|dictado)\s+(?:al\s+|en\s+|de\s+)?(?:editor|texto)$/.test(s)) return {kind:"editor_dictate"};
  if (/^(?:limpia|limpiar|vaciar|vacia|borra|borrar)\s+(?:el\s+)?(?:editor(?: de texto)?|texto del editor)$/.test(s)) return {kind:"editor_clear"};
  if (/^(?:copia|copiar)\s+(?:el\s+)?(?:texto|editor|texto del editor)$/.test(s)) return {kind:"editor_copy"};
  if (/^(?:pega|pegar)\s+(?:el\s+)?(?:texto|portapapeles|en el editor|al editor)$/.test(s)) return {kind:"editor_paste"};
  if (/^(?:borra|borrar|limpia|limpiar)\s+(?:la\s+)?firma(?:\s+visual)?$/.test(s)) return {kind:"signature_clear"};
  if (/^(?:guarda|guardar|descarga|descargar|exporta|exportar)\s+(?:la\s+)?firma(?:\s+visual)?$/.test(s)) return {kind:"signature_export"};

  if (/^(?:(?:activa|activar|pon|cambia|cambiar|selecciona|usar|usa|elige|elegir|modo|tema|color)\s+(?:el\s+|la\s+|de\s+|a\s+|en\s+)?)?(?:alto contraste|contraste alto|contraste)$/.test(s)) return {kind:"theme",theme:"contraste"};
  if (/^(?:(?:activa|activar|pon|cambia|selecciona|usa|elige|modo|tema|color)\s+(?:el\s+|la\s+|de\s+|a\s+|en\s+)?)?(?:oscuro|noche|nocturno)$/.test(s)) return {kind:"theme",theme:"noche"};
  if (/^(?:(?:activa|activar|pon|cambia|selecciona|usa|elige|modo|tema|color)\s+(?:el\s+|la\s+|de\s+|a\s+|en\s+)?)?(?:claro|blanco|diurno)$/.test(s)) return {kind:"theme",theme:"claro"};
  if (/^(?:(?:activa|activar|pon|cambia|selecciona|usa|elige|modo|tema|color)\s+(?:el\s+|la\s+|de\s+|a\s+|en\s+)?)?(?:ambar|ambar suave|naranja)$/.test(s)) return {kind:"theme",theme:"ambar"};
  if (/^(?:(?:activa|activar|pon|cambia|selecciona|usa|elige|modo|tema|color)\s+(?:el\s+|la\s+|de\s+|a\s+|en\s+)?)?(?:azul|azul suave)$/.test(s)) return {kind:"theme",theme:"azul"};
  if (/^(?:(?:pon|cambia|selecciona|usa|elige|modo|tema|color|modo para)\s+(?:el\s+|la\s+|de\s+|a\s+|en\s+)?)?(?:daltonismo|daltonicos|distincion por formas)$/.test(s)) return {kind:"theme",theme:"daltonismo"};
  if (/^(?:activa|activar|pon|poner|aumenta|aumentar|desactiva|desactivar|quita|quitar)\s+(?:el\s+|la\s+)?(?:texto grande|letra grande|letras grandes|fuente grande)$/.test(s)) return {kind:"accessibility",feature:"large",value:! /^(?:desactiva|desactivar|quita|quitar)/.test(s)};
  if (/^(?:activa|activar|pon|poner|desactiva|desactivar|quita|quitar)\s+(?:las\s+|la\s+)?(?:animaciones reducidas|reduccion de movimiento|menos movimiento|movimiento reducido)$/.test(s)) return {kind:"accessibility",feature:"reduced-motion",value:! /^(?:desactiva|desactivar|quita|quitar)/.test(s)};
  if (/^(?:activa|activar|desactiva|desactivar)\s+(?:la\s+)?(?:palabra de activacion|decir omega antes|comando omega)$/.test(s)) return {kind:"accessibility",feature:"wakeword",value:/^activa/.test(s)};

  if (/^(?:limpia|limpiar|borra|borrar|vaciar)\s+(?:el\s+)?(?:codigo|codigo generado|editor de codigo)$/.test(s)) return {kind:"code_clear"};
  if (/^(?:copia|copiar)\s+(?:el\s+)?(?:codigo|codigo generado)$/.test(s)) return {kind:"code_copy"};
  if (/^(?:descarga|descargar|guarda|guardar)\s+(?:el\s+)?(?:codigo|codigo generado|archivo de codigo)$/.test(s)) return {kind:"code_download"};
  const langMatch=s.match(/^(?:cambia|cambiar|elige|elegir|selecciona|usar|usa|pon|poner|lenguaje|idioma)\s+(?:el\s+)?(?:lenguaje\s+|idioma\s+|a\s+)?(powershell|python|javascript|typescript|cmd|batch)$/);
  if (langMatch) return {kind:"code_language",language:languageFor(langMatch[1]) || "powershell"};
  const code = /^(?:programa|programar|escribe codigo|escribir codigo|crea (?:un )?(?:script|programa|funcion)|genera (?:un )?(?:script|programa|codigo|funcion)|codifica|desarrolla (?:un )?(?:script|programa|codigo))\b/.test(s);
  if (code) return {kind:"code_prepare",text,language:languageFor(s)};

  const nav=findNavigation(s);
  if (nav) return {kind:"navigate",section:nav.id,label:nav.label};

  if (/^(?:activa|activar|enciende|encender|comienza|comenzar|inicia|iniciar)\s+(?:el\s+|la\s+)?(?:microfono|escucha|voz|conversacion)$/.test(s)) return {kind:"voice_start"};
  if (/^(?:deten|detener|para|parar|apaga|apagar|silencia|silenciar)\s+(?:el\s+|la\s+)?(?:microfono|escucha|voz|conversacion)$/.test(s)) return {kind:"voice_stop"};
  if (/^(?:pregunta|preguntar|consulta|consultar|responde|responder|explica|explicar|investiga|investigar)\s+(?:a\s+)?(?:omega\s+)?(.{3,})$/.test(s)) return {kind:"ai_draft",text};

  if (/^(?:abre|abrir|inicia|iniciar|ejecuta|ejecutar|abre el programa|abrir el programa)\b/.test(s)) return {kind:"unsupported_app",text};
  return null;
}

export const OMEGA_VOICE_EXAMPLES = [
  "ve a inicio", "ir a cuenta y planes", "abre código por voz", "siguiente menú", "abre calculadora",
  "abre bloc de notas", "abre explorador", "diagnóstico de Windows", "estado del agente",
  "guarda idea mejorar el holograma", "muestra mis ideas", "escribe en el editor hola OMEGA",
  "copia el texto", "pega el texto", "limpia el editor", "cambia a alto contraste",
  "activa texto grande", "activa menos movimiento", "marca avisos como leídos",
  "programa un script PowerShell que revise la RAM", "selecciona Python",
  "copia código", "descarga código", "consulta a OMEGA sobre programación", "ayuda"
] as const;
