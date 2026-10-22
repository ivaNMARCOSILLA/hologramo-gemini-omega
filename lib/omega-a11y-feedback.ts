/**
 * OMEGA A11y v1.1 - Retroalimentación multimodal + preferencia de interfaz futurista.
 * Visual (subtítulos), auditiva (voz) y táctil (vibración). Solo localStorage local.
 */
export type A11yPrefs = {
  voz: boolean;
  subtitulos: boolean;
  vibracion: boolean;
  altoContraste: boolean;
  textoGrande: boolean;
  movimientoReducido: boolean;
  futurista: boolean;
};
export type FeedbackKind = "info" | "ok" | "error";

const KEY = "omega-a11y-prefs-v1";

export const defaultPrefs: A11yPrefs = {
  voz: false,
  subtitulos: true,
  vibracion: true,
  altoContraste: false,
  textoGrande: false,
  movimientoReducido: false,
  futurista: true,
};

export const ownUtterances = new WeakSet<SpeechSynthesisUtterance>();

export function loadPrefs(): A11yPrefs {
  if (typeof window === "undefined") return { ...defaultPrefs };
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    const out: A11yPrefs = { ...defaultPrefs };
    if (parsed && typeof parsed === "object") {
      for (const k of Object.keys(defaultPrefs) as (keyof A11yPrefs)[]) {
        const v = (parsed as Record<string, unknown>)[k];
        if (typeof v === "boolean") out[k] = v;
      }
    }
    if (!raw && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) out.movimientoReducido = true;
    if (!raw && window.matchMedia?.("(prefers-contrast: more)").matches) out.altoContraste = true;
    return out;
  } catch {
    return { ...defaultPrefs };
  }
}

export function applyPrefs(p: A11yPrefs): void {
  if (typeof document === "undefined") return;
  const r = document.documentElement;
  r.dataset.omegaContrast = p.altoContraste ? "alto" : "normal";
  r.dataset.omegaText = p.textoGrande ? "grande" : "normal";
  r.dataset.omegaMotion = p.movimientoReducido ? "reducido" : "normal";
  r.dataset.omegaUi = p.futurista ? "futurista" : "clasica";
  window.dispatchEvent(new CustomEvent("omega-a11y-prefs", { detail: p }));
}

export function savePrefs(p: A11yPrefs): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento: se aplica solo en esta sesión */
  }
  applyPrefs(p);
}

export function vibrate(kind: FeedbackKind = "info"): void {
  const p = loadPrefs();
  if (!p.vibracion || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(kind === "error" ? [90, 60, 90] : kind === "ok" ? 40 : 20);
}

export function feedback(msg: string, kind: FeedbackKind = "info"): void {
  if (typeof window === "undefined" || !msg) return;
  const p = loadPrefs();
  window.dispatchEvent(new CustomEvent("omega-a11y-caption", { detail: { msg, kind, visible: p.subtitulos } }));
  vibrate(kind);
  if (p.voz && "speechSynthesis" in window && !window.speechSynthesis.speaking) {
    const u = new SpeechSynthesisUtterance(msg);
    u.lang = "es-ES";
    ownUtterances.add(u);
    window.speechSynthesis.speak(u);
  }
}