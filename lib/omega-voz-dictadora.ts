import { createBrowserClient } from "@supabase/ssr";

/**
 * OMEGA voz dictadora v1.
 * - En la web pública, "abre X" va a la cola segura /api/omega-windows (el servidor valida
 *   origen, sesión, lista blanca, una acción a la vez y límite horario). El puente del PC
 *   pide SIEMPRE consentimiento local por teclado/ratón: la voz nunca aprueba.
 * - Respuestas locales (hora, fecha) sin IA.
 */
const APPS: { id: string; label: string; re: RegExp }[] = [
  { id: "calculator", label: "Calculadora", re: /\bcalculadora\b/ },
  { id: "notepad", label: "Bloc de notas", re: /\bbloc de notas\b|\bnotepad\b/ },
  { id: "snipping", label: "Recortes", re: /\brecortes?\b|\bcaptura de pantalla\b/ },
  { id: "explorer", label: "Explorador de archivos", re: /\bexplorador\b|\bmis archivos\b/ },
  { id: "paint", label: "Paint", re: /\bpaint\b/ },
  { id: "edge", label: "Microsoft Edge", re: /\bedge\b/ },
  { id: "chrome", label: "Google Chrome", re: /\bchrome\b/ },
  { id: "settings", label: "Configuración de Windows", re: /\bconfiguracion\b/ },
  { id: "word", label: "Microsoft Word", re: /\bword\b/ },
  { id: "excel", label: "Microsoft Excel", re: /\bexcel\b/ },
  { id: "powerpoint", label: "PowerPoint", re: /\bpower ?point\b/ },
  { id: "vscode", label: "Visual Studio Code", re: /\bvisual studio\b|\bvs ?code\b/ },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[¿?¡!.,;:]/g, " ").replace(/\s+/g, " ").trim();

export function appFromText(text: string): { id: string; label: string } | null {
  const t = norm(text);
  const hit = APPS.find((a) => a.re.test(t));
  return hit ? { id: hit.id, label: hit.label } : null;
}

export function omegaLocalAnswer(raw: string): string | null {
  const t = norm(raw);
  const now = new Date();
  if (/\b(que hora es|dime la hora|que hora tienes)\b/.test(t))
    return `Son las ${now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}.`;
  if (/\b(que dia es hoy|que dia es|que fecha es|dime la fecha|a que estamos)\b/.test(t))
    return `Hoy es ${now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.`;
  return null;
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || typeof window === "undefined") return null;
  return createBrowserClient(url, key);
}

async function windowsFetch(init: RequestInit = {}): Promise<Response | null> {
  const sb = client();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch("/api/omega-windows", { ...init, headers, credentials: "same-origin", cache: "no-store" });
}

const ERR: Record<string, string> = {
  windows_agent_offline: "Tu PC no está conectado. Abre en Windows: npm run agent:windows, y déjalo abierto.",
  another_action_in_progress: "Ya hay una orden esperando en tu PC. Acéptala o deníegala primero.",
  hourly_action_limit: "Has llegado al límite de doce órdenes por hora. Espera un poco.",
  app_not_allowed: "Esa aplicación no está en la lista permitida.",
  origin_denied: "Orden rechazada por seguridad: usa siempre el mismo dominio, hologramo.es.",
  unauthenticated: "Inicia sesión en tu cuenta para enviar órdenes a tu PC.",
  not_admin: "Solo la cuenta de administrador puede enviar órdenes a Windows.",
  mfa_required: "Para enviar órdenes a Windows activa la verificación en dos pasos de tu cuenta.",
};

export async function sendRemoteWindowsOrder(text: string, say: (msg: string) => void): Promise<boolean> {
  const app = appFromText(text);
  if (!app) { say("No sé qué aplicación quieres abrir. Prueba: abre calculadora."); return false; }
  let res: Response | null = null;
  try {
    res = await windowsFetch({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app: app.id }) });
  } catch { say("No hay conexión con el servidor. Inténtalo de nuevo."); return false; }
  if (!res) { say(ERR.unauthenticated); return false; }
  let body: Record<string, unknown> = {};
  try { body = (await res.json()) as Record<string, unknown>; } catch { /* sin cuerpo */ }
  if (!res.ok) {
    const code = String(body.error ?? res.status);
    say(ERR[code] ?? `No se pudo enviar la orden (${code}).`);
    return false;
  }
  const jobId = String((body.job as { id?: unknown } | undefined)?.id ?? "");
  say(`Orden enviada: ${app.label}. Acepta el permiso en la ventana de Windows.`);
  if (!jobId) return true;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await windowsFetch();
      if (!r || !r.ok) continue;
      const j = (await r.json()) as { jobs?: { id?: string; status?: string }[] };
      const st = j.jobs?.find((x) => x.id === jobId)?.status;
      if (st === "completed") { say(`${app.label} abierta en tu PC.`); return true; }
      if (st === "denied") { say(`Has denegado abrir ${app.label}.`); return false; }
      if (st === "failed" || st === "expired") { say(`Windows no pudo abrir ${app.label}.`); return false; }
    } catch { /* reintento */ }
  }
  say(`Sin respuesta del PC sobre ${app.label}. Revisa la ventana de permiso.`);
  return false;
}