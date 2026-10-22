/** OMEGA AV v0.7: atajos locales de interfaz, sin API ni ejecución de sistema. */
export type OmegaAVSection = "cuenta" | "inicio" | "acciones" | "codigo" | "avisos" | "herramientas" | "conocimiento" | "ia-avanzada" | "ajustes";
export type OmegaAVCommand =
  | { kind: "navigate"; section: OmegaAVSection; label: string }
  | { kind: "idea"; text: string };

function tidy(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
}
const targets: { id: OmegaAVSection; label: string; phrase: RegExp }[] = [
  { id: "cuenta", label: "Cuenta y planes", phrase: /^(?:cuenta|mi cuenta|planes|suscripcion|suscripciones|acceso)$/ },
  { id: "inicio", label: "Inicio", phrase: /^(?:inicio|principal|home)$/ },
  { id: "acciones", label: "Acciones", phrase: /^(?:acciones|ordenes|comandos|acciones rapidas)$/ },
  { id: "codigo", label: "Código por voz", phrase: /^(?:codigo|codigo por voz|programacion|editor de codigo)$/ },
  { id: "avisos", label: "Avisos", phrase: /^(?:avisos|notificaciones)$/ },
  { id: "herramientas", label: "Herramientas", phrase: /^(?:herramientas|editor de texto|copiar y pegar)$/ },
  { id: "conocimiento", label: "Conocimiento", phrase: /^(?:conocimiento|biblioteca|mis ideas|ideas|recetas)$/ },
  { id: "ia-avanzada", label: "IA avanzada", phrase: /^(?:ia avanzada|inteligencia artificial|mercado de ia|mercado|modelos)$/ },
  { id: "ajustes", label: "Ajustes", phrase: /^(?:ajustes|configuracion|preferencias)$/ },
];

/** Nunca interpreta "abre calculadora" como un comando de navegación. */
export function routeVoiceShortcut(raw: string): OmegaAVCommand | null {
  if (typeof raw !== "string" || raw.length > 680) return null;
  const original = raw.trim();
  const normalized = tidy(original);
  const ideaMatch = original.match(/^\s*(?:guarda|guardar|anota|apunta|recuerda)\s+(?:la\s+)?idea\s*(?:de|que|:)?\s+(.+)$/i);
  if (ideaMatch && ideaMatch[1].trim().length >= 3)
    return { kind: "idea", text: ideaMatch[1].trim().slice(0, 600) };
  const prefix = /^(?:ir|ve|vamos|entra|abre|abrir|muestra|mostrar|muestrame|abre el menu|cambia|cambiar)(?:\s+(?:a|al|a la|a los|en|el|la|los|las|menu|seccion|de|del))*\s+/;
  const target = normalized.replace(prefix, "");
  // Para evitar confundir una orden Windows con navegar, exigimos un prefijo o frase explicita de menu.
  if (target === normalized && !/^(?:mis ideas|menu (?:de |del )?)/.test(normalized)) return null;
  const short = target.replace(/^(?:menu\s+(?:de\s+|del\s+)?)|^(?:seccion\s+(?:de\s+)?)|^(?:a\s+)/, "").trim();
  const found = targets.find(t => t.phrase.test(short));
  return found ? { kind: "navigate", section: found.id, label: found.label } : null;
}
