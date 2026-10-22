"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { feedback } from "../lib/omega-a11y-feedback";
import { adminFetch, onAuthChange } from "../lib/omega-admin-fetch";

/**
 * Supervisor OMEGA v2 (solo admin). Métricas solo en localStorage.
 * v2: distingue desarrollo/producción, identifica el elemento LCP y la interacción más lenta,
 * y no cuenta la vista previa de cámara ni canvas auxiliares como fallos de accesibilidad.
 */
type Snapshot = {
  t: number; lcp: number | null; cls: number; longTasks: number; longTaskMs: number;
  inp: number | null; fps: number | null; errores: number; mem: number | null;
  a11y: Record<string, number>;
  modo?: "dev" | "prod"; lcpEl?: string; inpEv?: string;
};
type AuditEntry = { ts?: string; event?: string; app?: string; result?: string; consent?: string; ms?: number; jobId?: string; after?: number };
const KEY = "omega-supervisor-history-v1";
const MAX = 30;
const MODO: "dev" | "prod" = process.env.NODE_ENV === "production" ? "prod" : "dev";

function readHist(): Snapshot[] {
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as Snapshot[]) : [];
  } catch {
    return [];
  }
}

function describeEl(el: Element | null | undefined): string {
  if (!el) return "desconocido";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cn = typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
  const txt = tag === "input" || tag === "textarea" ? "" : (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
  return `${tag}${id}${cn}${txt ? ` "${txt}"` : ""}`.slice(0, 120);
}

function bigVisible(el: Element): boolean {
  if (el.closest("[aria-hidden='true']")) return false;
  const r = el.getBoundingClientRect();
  return r.width >= 120 && r.height >= 120;
}

function auditA11y(): Record<string, number> {
  const d = document;
  const named = (el: Element) =>
    !!(el.getAttribute("aria-label")?.trim() || el.getAttribute("aria-labelledby") ||
       el.getAttribute("title")?.trim() || el.textContent?.trim() || el.querySelector("img[alt]:not([alt=''])"));
  const inputs = Array.from(d.querySelectorAll("input:not([type=hidden]):not([type=button]):not([type=submit]), select, textarea"));
  const lang = d.documentElement.getAttribute("lang")?.toLowerCase() ?? "";
  return {
    imagenesSinAlt: d.querySelectorAll("img:not([alt])").length,
    botonesSinNombre: Array.from(d.querySelectorAll("button, [role=button], a[href]")).filter((el) => !named(el)).length,
    camposSinEtiqueta: inputs.filter((el) => {
      const id = el.id;
      return !(el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label") ||
               (id && d.querySelector(`label[for="${CSS.escape(id)}"]`)));
    }).length,
    // Solo vídeos con archivo real (con audio potencial). La vista previa de cámara no necesita subtítulos.
    videosSinSubtitulos: Array.from(d.querySelectorAll("video")).filter((v) => {
      const vv = v as HTMLVideoElement;
      if (vv.srcObject) return false;
      const hasFile = !!(vv.currentSrc || v.getAttribute("src") || v.querySelector("source[src]"));
      return hasFile && !v.querySelector("track[kind=captions], track[kind=subtitles]");
    }).length,
    tabindexPositivo: Array.from(d.querySelectorAll("[tabindex]")).filter((el) => Number(el.getAttribute("tabindex")) > 0).length,
    idiomaNoEspanol: lang.startsWith("es") ? 0 : 1,
    // Solo canvas grandes y visibles (el holograma); los auxiliares de MediaPipe no cuentan.
    canvasSinDescripcion: Array.from(d.querySelectorAll("canvas")).filter(
      (c) => bigVisible(c) && !(c.getAttribute("aria-label") || c.getAttribute("role") || c.textContent?.trim())
    ).length,
  };
}

const A11Y_MSG: Record<string, string> = {
  imagenesSinAlt: "imágenes sin alt: el lector de pantalla no puede describirlas.",
  botonesSinNombre: "botones/enlaces sin nombre accesible: añadir aria-label (crítico para usuarios ciegos).",
  camposSinEtiqueta: "campos de formulario sin etiqueta asociada.",
  videosSinSubtitulos: "vídeos con audio sin <track> de subtítulos (crítico para usuarios sordos).",
  tabindexPositivo: "elementos con tabindex > 0: rompen el orden lógico del teclado.",
  idiomaNoEspanol: '<html> no tiene lang="es": el lector de pantalla pronunciará mal.',
  canvasSinDescripcion: 'canvas 3D sin descripción: añadir role="img" y aria-label al holograma.',
};

function recomendaciones(s: Snapshot): string[] {
  const r: string[] = [];
  if ((s.modo ?? "dev") === "dev") r.push("Medido en DESARROLLO (npm run dev): LCP e INP salen muy inflados. Mide con npm run build && npm run start antes de optimizar.");
  if (s.lcp !== null && s.lcp > 2500) r.push(`Carga lenta (LCP ${Math.round(s.lcp)} ms > 2500). Elemento: ${s.lcpEl ?? "?"}. Cargar HologramScene con next/dynamic (ssr:false) y diferir MediaPipe/TensorFlow hasta activar la cámara (app/page.tsx).`);
  if (s.cls > 0.1) r.push(`Saltos de diseño (CLS ${s.cls}): reservar tamaño fijo a panel, cámara y canvas.`);
  if (s.longTasks > 5) r.push(`${s.longTasks} tareas largas (${s.longTaskMs} ms bloqueados): mover la detección de manos a un Web Worker o bajar su frecuencia.`);
  if (s.inp !== null && s.inp > 200) r.push(`Interacción más lenta: ${Math.round(s.inp)} ms (${s.inpEv ?? "evento desconocido"}). Revisar ese manejador en app/page.tsx u OmegaUnifiedPanel.tsx.`);
  if (s.fps !== null && s.fps < 45) r.push(`FPS ${s.fps}: limitar dpr del Canvas a [1, 1.5], reducir geometría o usar frameloop="demand" en reposo.`);
  if (s.errores > 0) r.push(`${s.errores} errores JavaScript en la sesión: revisar la consola.`);
  if (s.mem !== null && s.mem > 400) r.push(`Memoria JS alta (${s.mem} MB): comprobar dispose() de geometrías/texturas Three.js y liberación de pistas de cámara.`);
  for (const [k, v] of Object.entries(s.a11y)) if (v > 0) r.push(`Accesibilidad: ${v} ${A11Y_MSG[k] ?? k}`);
  if (r.length === 0) r.push("Sin problemas detectados en esta sesión.");
  return r;
}

const totalA11y = (s: Snapshot) => Object.values(s.a11y).reduce((a, b) => a + b, 0);

const EV: Record<string, string> = {
  start: "Puente iniciado", stop: "Puente detenido", job: "Orden", job_rejected: "Orden rechazada",
  error: "Sin conexión", reconnected: "Reconectado", finish_failed: "Resultado no enviado",
};
const RES: Record<string, string> = { completed: "completada", denied: "denegada", failed: "fallida" };
function fmtAudit(e: AuditEntry): string {
  const parts = [e.ts ? new Date(e.ts).toLocaleString("es-ES") : "?", EV[e.event ?? ""] ?? e.event ?? "evento"];
  if (e.app) parts.push(e.app);
  if (e.result) parts.push(RES[e.result] ?? e.result);
  if (e.consent) parts.push(e.consent === "trusted_session" ? "sesión de confianza" : "permiso en pantalla");
  if (typeof e.ms === "number") parts.push(`${Math.round(e.ms / 1000)} s`);
  return parts.join(" · ");
}

export default function OmegaSupervisor() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [audit, setAudit] = useState<{ available: boolean; entries: AuditEntry[] } | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await adminFetch("/api/omega-admin/status");
        const j: unknown = r && r.ok ? await r.json() : null;
        const o = (j ?? {}) as Record<string, unknown>;
        if (!alive) return;
        const ok = o.role === "admin";
        setIsAdmin(ok);
        setMfa(o.mfa === true);
        if (ok) setHistory(readHist());
      } catch {
        if (alive) setIsAdmin(false);
      }
    };
    void check();
    const off = onAuthChange(() => { void check(); });
    return () => { alive = false; off(); };
  }, []);

  const loadAudit = useCallback(async () => {
    try {
      const r = await adminFetch("/api/omega-admin/audit");
      const j: unknown = r && r.ok ? await r.json() : null;
      const o = (j ?? {}) as { available?: unknown; entries?: unknown };
      setAudit({ available: o.available === true, entries: Array.isArray(o.entries) ? (o.entries as AuditEntry[]).slice(0, 15) : [] });
    } catch {
      setAudit({ available: false, entries: [] });
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const t = window.setTimeout(() => { void loadAudit(); }, 0);
    return () => window.clearTimeout(t);
  }, [isAdmin, loadAudit]);

  useEffect(() => {
    if (!isAdmin) return;
    let lcp: number | null = null;
    let lcpEl = "";
    let cls = 0, longTasks = 0, longTaskMs = 0, errores = 0;
    let inp: number | null = null;
    let inpEv = "";
    let fps: number | null = null;
    const observers: PerformanceObserver[] = [];
    const watch = (type: string, cb: (e: PerformanceEntry) => void, extra: Record<string, unknown> = {}) => {
      try {
        const o = new PerformanceObserver((list) => list.getEntries().forEach(cb));
        o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
        observers.push(o);
      } catch { /* tipo no soportado */ }
    };
    watch("largest-contentful-paint", (e) => {
      lcp = e.startTime;
      lcpEl = describeEl((e as unknown as { element?: Element | null }).element);
    });
    watch("layout-shift", (e) => {
      const s = e as unknown as { value: number; hadRecentInput: boolean };
      if (!s.hadRecentInput) cls += s.value;
    });
    watch("longtask", (e) => { longTasks++; longTaskMs += e.duration; });
    watch("event", (e) => {
      if (e.duration > (inp ?? 0)) {
        inp = e.duration;
        const t = (e as unknown as { target?: Node | null }).target;
        inpEv = `${e.name} en ${describeEl(t instanceof Element ? t : null)} a los ${Math.round(e.startTime)} ms`;
      }
    }, { durationThreshold: 40 });
    const onErr = () => { errores++; };
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onErr);

    let raf = 0, frames = 0, start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      frames++;
      if (now - start < 3000) raf = requestAnimationFrame(tick);
      else fps = Math.round((frames * 1000) / (now - start));
    };
    const tFps = window.setTimeout(() => { raf = requestAnimationFrame(tick); }, 4000);
    const tSnap = window.setTimeout(() => {
      const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
      const snap: Snapshot = {
        t: Date.now(), lcp, cls: Math.round(cls * 1000) / 1000, longTasks, longTaskMs: Math.round(longTaskMs),
        inp, fps, errores, mem: mem ? Math.round(mem / 1048576) : null, a11y: auditA11y(),
        modo: MODO, lcpEl: lcpEl || undefined, inpEv: inpEv || undefined,
      };
      const hist = [...readHist(), snap].slice(-MAX);
      try { window.localStorage.setItem(KEY, JSON.stringify(hist)); } catch { /* sin almacenamiento */ }
      setHistory(hist);
    }, 12000);

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onErr);
      window.clearTimeout(tFps);
      window.clearTimeout(tSnap);
      cancelAnimationFrame(raf);
    };
  }, [isAdmin]);

  const last = history[history.length - 1];
  const recs = useMemo(() => (last ? recomendaciones(last) : []), [last]);
  const rows = useMemo(() => {
    if (!last) return [];
    const mode = last.modo ?? "dev";
    const prev = history.slice(0, -1).filter((h) => (h.modo ?? "dev") === mode).slice(-5);
    const avg = (f: (s: Snapshot) => number | null) => {
      const v = prev.map(f).filter((x): x is number => typeof x === "number");
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    };
    const defs: { label: string; f: (s: Snapshot) => number | null; lower: boolean }[] = [
      { label: "Carga LCP (ms)", f: (s) => s.lcp, lower: true },
      { label: "Bloqueo (ms)", f: (s) => s.longTaskMs, lower: true },
      { label: "Peor interacción (ms)", f: (s) => s.inp, lower: true },
      { label: "FPS", f: (s) => s.fps, lower: false },
      { label: "Problemas accesibilidad", f: totalA11y, lower: true },
      { label: "Errores JS", f: (s) => s.errores, lower: true },
    ];
    return defs.map((d) => {
      const now = d.f(last);
      const a = avg(d.f);
      let trend = "\u2014";
      let cls = "";
      if (now !== null && a !== null) {
        const better = d.lower ? now < a * 0.95 : now > a * 1.05;
        const worse = d.lower ? now > a * 1.05 : now < a * 0.95;
        trend = better ? "mejora" : worse ? "empeora" : "estable";
        cls = better ? "omega-trend--mejor" : worse ? "omega-trend--peor" : "";
      }
      return { label: d.label, now, avg: a, trend, cls };
    });
  }, [history, last]);

  if (!isAdmin) return null;

  const copiar = async () => {
    const texto =
      `Eres el supervisor técnico de OMEGA, una web para personas con discapacidad visual, auditiva y táctil. ` +
      `Analiza estas métricas reales de ${history.length} sesión(es) (campo "modo": dev = npm run dev, prod = build de producción) ` +
      `y propón mejoras priorizadas indicando el archivo exacto. No propongas quitar controles de seguridad ni el gate de administrador.\n\n` +
      JSON.stringify(history.slice(-10), null, 2) +
      `\n\nRecomendaciones automáticas:\n- ` + recs.join("\n- ") +
      `\n\nAuditoría agente Windows (últimas entradas):\n` + ((audit?.entries ?? []).map(fmtAudit).join("\n") || "(vacía)");
    try {
      await navigator.clipboard.writeText(texto);
      feedback("Informe copiado. Pégalo en tu IA personal.", "ok");
    } catch {
      feedback("No se pudo copiar el informe (permiso de portapapeles).", "error");
    }
  };
  const borrar = () => {
    try { window.localStorage.removeItem(KEY); } catch { /* nada */ }
    setHistory([]);
    feedback("Historial del supervisor borrado.", "ok");
  };

  return (
    <details className="omega-supervisor">
      <summary>Supervisor OMEGA (admin{mfa ? " · MFA" : ""}) · {MODO === "prod" ? "producción" : "desarrollo"} · {history.length} sesiones</summary>
      <div className="omega-supervisor__body">
        {!last ? (
          <p>Midiendo esta sesión (unos 12 segundos)…</p>
        ) : (
          <>
            <table>
              <caption className="omega-sr-only">Métricas actuales frente a la media de sesiones anteriores del mismo modo</caption>
              <thead>
                <tr><th scope="col">Métrica</th><th scope="col">Ahora</th><th scope="col">Media</th><th scope="col">Tendencia</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td>{r.now === null ? "\u2014" : Math.round(r.now * 100) / 100}</td>
                    <td>{r.avg === null ? "\u2014" : Math.round(r.avg * 100) / 100}</td>
                    <td className={r.cls}>{r.trend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Recomendaciones</h3>
            <ul>{recs.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </>
        )}
        <h3>Auditoría del agente Windows</h3>
        {!audit ? (
          <p>Cargando…</p>
        ) : !audit.available ? (
          <p>Sin registro local todavía (arranca npm run agent:windows en este PC).</p>
        ) : audit.entries.length === 0 ? (
          <p>Registro vacío.</p>
        ) : (
          <ul>{audit.entries.map((e, i) => <li key={`${e.ts ?? "x"}-${i}`}>{fmtAudit(e)}</li>)}</ul>
        )}
        <button type="button" onClick={() => { void loadAudit(); }}>Actualizar auditoría</button>
        <button type="button" onClick={copiar}>Copiar informe para la IA personal</button>
        <button type="button" onClick={borrar}>Borrar historial</button>
        <p className="omega-supervisor__note">Métricas solo en este navegador. No se envía nada automáticamente.</p>
      </div>
    </details>
  );
}