"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { adminFetch, onAuthChange } from "../lib/omega-admin-fetch";
import { routeOmegaCommand } from "../lib/omega-command-v11";
import { feedback } from "../lib/omega-a11y-feedback";

/** OMEGA diagnóstico v1 (solo admin). Comprueba cada función SIN ejecutar acciones sensibles. */
type Estado = "ok" | "aviso" | "fallo" | "info";
type Res = { estado: Estado; detalle: string };
type Check = { id: string; grupo: string; nombre: string; costoso: boolean; run: () => Promise<Res> };
type ServerDiag = {
  mfa?: boolean;
  runtime?: { vercel: boolean; region: string | null; node: string; env: string };
  env?: Record<string, boolean>;
  openrouter?: { ok: boolean; detail: string; usage?: number | null; limit?: number | null; remaining?: number | null };
  model?: string;
};

const ok = (detalle: string): Res => ({ estado: "ok", detalle });
const aviso = (detalle: string): Res => ({ estado: "aviso", detalle });
const fallo = (detalle: string): Res => ({ estado: "fallo", detalle });
const info = (detalle: string): Res => ({ estado: "info", detalle });
const ICON: Record<Estado, string> = { ok: "✅ OK", aviso: "⚠️ Aviso", fallo: "❌ Fallo", info: "ℹ️ Info" };

const CANCEL_RE = /^(?:oye\s+)?(?:omega\s+)?(?:cancelar?|cancela|cerrar?|cierra|anular?|anula|no)$/i;
const CODE_RE = /^(?:omega\s+)?(?:programa|genera|crea|escribe|hazme|haz)\b.*\b(?:c[oó]digo|script|funci[oó]n|componente|programa|p[aá]gina|html|css|python|javascript|typescript|sql)\b/i;
const sinPuntuacion = (t: string) => t.replace(/[.,;:!?¡¿]+/g, "").trim();

async function authFetch(path: string, init: RequestInit = {}): Promise<Response | null> {
  if (!path.startsWith("/api/")) throw new Error("Ruta no permitida");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const { data } = await createBrowserClient(url, key).auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers, credentials: "same-origin", cache: "no-store" });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`Sin respuesta en ${ms / 1000} s`)), ms);
    p.then((v) => { window.clearTimeout(t); resolve(v); }, (e: unknown) => { window.clearTimeout(t); reject(e); });
  });
}

async function perm(name: string): Promise<string> {
  try { return (await navigator.permissions.query({ name: name as PermissionName })).state; } catch { return "desconocido"; }
}

function store(k: string): string | null {
  try { return window.localStorage.getItem(k); } catch { return null; }
}

function buildChecks(getServer: () => Promise<ServerDiag | null>): Check[] {
  const list: Check[] = [];
  const add = (grupo: string, nombre: string, run: () => Promise<Res>, costoso = false) =>
    list.push({ id: `${grupo}:${nombre}`, grupo, nombre, run, costoso });

  // ----- Cuenta -----
  add("Cuenta", "Sesión y rol de administrador", async () => {
    const r = await adminFetch("/api/omega-admin/status");
    if (!r) return fallo("Sin sesión iniciada");
    const j = (await r.json().catch(() => ({}))) as { role?: string; mfa?: boolean; error?: string };
    if (j.role !== "admin") return fallo(`HTTP ${r.status} ${j.error ?? ""}`.trim());
    return j.mfa ? ok("Administrador con verificación en dos pasos") : aviso("Administrador SIN verificación en dos pasos: las acciones que exigen MFA fallarán");
  });

  // ----- Servidor -----
  add("Servidor", "Entorno de ejecución", async () => {
    const s = await getServer();
    if (!s?.runtime) return fallo("La ruta /api/omega-admin/diagnostics no responde");
    const r = s.runtime;
    return info(`${r.vercel ? "Vercel" : "Local"}${r.region ? " · " + r.region : ""} · Node ${r.node} · ${r.env}`);
  });
  add("Servidor", "Variables de entorno (solo existencia)", async () => {
    const env = (await getServer())?.env;
    if (!env) return fallo("Sin datos del servidor");
    const req = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "OPENROUTER_API_KEY"];
    const faltan = req.filter((v) => !env[v]);
    const opcionales = Object.keys(env).filter((v) => !req.includes(v) && !env[v]);
    if (faltan.length) return fallo("Faltan: " + faltan.join(", "));
    return opcionales.length ? aviso("Obligatorias OK. Opcionales sin definir: " + opcionales.join(", ")) : ok("Todas definidas");
  });
  add("Servidor", "OpenRouter (clave y saldo)", async () => {
    const o = (await getServer())?.openrouter;
    if (!o) return fallo("Sin datos del servidor");
    if (!o.ok) return fallo(o.detail);
    const usado = `usado ${(o.usage ?? 0).toFixed(2)} $`;
    if (o.remaining == null) return ok(`Clave válida · ${usado} · sin límite fijado`);
    const d = `Clave válida · ${usado} · quedan ${o.remaining.toFixed(2)} $`;
    return o.remaining < 1 ? aviso(d + " (saldo bajo)") : ok(d);
  });
  add("Servidor", "Modelo del motor de código", async () => info((await getServer())?.model ?? "desconocido"));

  // ----- Voz -----
  add("Voz", "Reconocimiento de voz del navegador", async () => {
    const w = window as unknown as Record<string, unknown>;
    return w.SpeechRecognition || w.webkitSpeechRecognition ? ok("Disponible") : fallo("No disponible: usa Chrome o Edge");
  });
  add("Voz", "Permiso del micrófono", async () => {
    const s = await perm("microphone");
    if (s === "granted") return ok("Concedido");
    if (s === "denied") return fallo("Bloqueado: candado de la barra de direcciones > Micrófono > Permitir");
    return aviso(`Estado: ${s}. El dictado no puede activarse solo hasta que lo concedas`);
  });
  add("Voz", "Síntesis de voz en español", async () => {
    if (!("speechSynthesis" in window)) return fallo("El navegador no puede hablar");
    const voices = await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) { resolve(v); return; }
      const t = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
      window.speechSynthesis.addEventListener("voiceschanged", () => { window.clearTimeout(t); resolve(window.speechSynthesis.getVoices()); }, { once: true });
    });
    const es = voices.filter((v) => v.lang.toLowerCase().startsWith("es"));
    return es.length ? ok(`${es.length} voz(es) en español: ${es[0].name}`) : aviso(`Sin voz en español (${voices.length} voces en total): OMEGA hablará con acento extranjero`);
  });
  add("Voz", "Intérprete de órdenes", async () => {
    const casos: [string, string][] = [
      ["Abre conocimiento.", "navigate"], ["guarda idea probar el diagnóstico", "idea_save"],
      ["abre calculadora", "windows_open"], ["alto contraste", "theme"],
      ["escribe en el editor hola", "editor_append"], ["ayuda", "help"],
    ];
    const malos = casos.filter(([f, k]) => {
      const r = routeOmegaCommand(f.replace(/[.,;:!?¡¿]+$/g, "").trim()) as unknown as { kind?: string } | null;
      return r?.kind !== k;
    }).map(([f]) => f);
    return malos.length ? fallo("No reconoce: " + malos.join(" · ")) : ok(`${casos.length}/${casos.length} frases reconocidas`);
  });
  add("Voz", "Detector de «cancelar»", async () => {
    const casos: [string, boolean][] = [["Cancelar.", true], ["cierra", true], ["No.", true], ["no abras nada", false], ["cierra la calculadora", false]];
    const malos = casos.filter(([f, e]) => CANCEL_RE.test(sinPuntuacion(f)) !== e).map(([f]) => f);
    return malos.length ? fallo("Mal clasificadas: " + malos.join(" · ")) : ok(`${casos.length}/${casos.length} correctas`);
  });
  add("Voz", "Detector de petición de código", async () => {
    const casos: [string, boolean][] = [["programa una función en python que sume", true], ["crea código html de una tarjeta", true], ["abre conocimiento", false], ["escribe en el editor hola mundo", false]];
    const malos = casos.filter(([f, e]) => CODE_RE.test(f) !== e).map(([f]) => f);
    return malos.length ? fallo("Mal clasificadas: " + malos.join(" · ")) : ok(`${casos.length}/${casos.length} correctas`);
  });
  add("Voz", "Configuración del dictado", async () => {
    const continuo = store("omega:dictado-continuo") !== "false";
    const siempre = store("omega:dictado-siempre") !== "false";
    const wake = store("omega:v09:wakeword") === "true";
    const boton = Array.from(document.querySelectorAll("button")).some((b) => b.textContent?.trim() === "Dictar orden");
    const d = `continuo: ${continuo ? "sí" : "no"} · siempre activo: ${siempre ? "sí" : "no"} · palabra OMEGA: ${wake ? "obligatoria" : "no"} · botón «Dictar orden»: ${boton ? "visible" : "no visible"}`;
    return continuo && siempre && boton ? ok(d) : aviso(d);
  });

  // ----- Windows -----
  add("Windows", "Puente y agente del PC", async () => {
    const r = await authFetch("/api/omega-windows");
    if (!r) return fallo("Sin sesión");
    const j = (await r.json().catch(() => ({}))) as { connected?: boolean; agentVersion?: string | null; jobs?: { app?: string; status?: string }[]; error?: string };
    if (!r.ok) return fallo(`HTTP ${r.status} ${j.error ?? ""}`.trim());
    if (!j.connected) return fallo("Puente desconectado. En el PC: Start-ScheduledTask -TaskName 'OMEGA Puente'");
    const last = j.jobs?.[0];
    return ok(`Conectado · versión ${j.agentVersion ?? "?"}${last ? ` · última orden: ${last.app ?? "?"} (${last.status ?? "?"})` : ""}`);
  });
  add("Windows", "Auditoría local del puente", async () => {
    const r = await adminFetch("/api/omega-admin/audit");
    if (!r || !r.ok) return fallo(`HTTP ${r?.status ?? "sin sesión"}`);
    const j = (await r.json().catch(() => ({}))) as { available?: boolean; entries?: { ts?: string; event?: string; app?: string; result?: string }[] };
    if (!j.available) return info("Solo disponible con npm run dev/start en tu PC (en Vercel no existe el registro)");
    const e = j.entries?.[0];
    return e ? ok(`Última entrada: ${e.event ?? "?"} ${e.app ?? ""} ${e.result ?? ""} · ${e.ts ? new Date(e.ts).toLocaleString("es-ES") : ""}`) : aviso("Registro vacío");
  });

  // ----- Holograma y cámara -----
  add("Holograma y cámara", "WebGL (gráficos 3D)", async () => {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") ?? c.getContext("webgl");
    if (!gl) return fallo("Sin WebGL: el holograma no puede dibujarse");
    const v2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return ok(v2 ? "WebGL 2" : "WebGL 1");
  });
  add("Holograma y cámara", "Holograma en pantalla", async () => {
    const cs = Array.from(document.querySelectorAll("canvas")).filter((c) => { const r = c.getBoundingClientRect(); return r.width >= 120 && r.height >= 120; });
    if (!cs.length) return fallo("No hay ningún canvas del holograma visible");
    const desc = cs.filter((c) => c.getAttribute("aria-label")).length;
    return desc === cs.length ? ok(`${cs.length} canvas visible(s), con descripción para lector de pantalla`) : aviso(`${cs.length - desc} canvas sin descripción`);
  });
  add("Holograma y cámara", "Cámara", async () => {
    if (!navigator.mediaDevices?.getUserMedia) return fallo("El navegador no permite cámara");
    const s = await perm("camera");
    const n = (await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[])).filter((d) => d.kind === "videoinput").length;
    const d = `permiso: ${s} · cámaras detectadas: ${n}`;
    if (s === "denied") return fallo(d + " (bloqueada en el navegador)");
    return n > 0 ? ok(d) : aviso(d);
  });

  // ----- Seguridad -----
  add("Seguridad", "Rutas retiradas (omega-code, omega-market)", async () => {
    const st = await Promise.all(["/api/omega-code", "/api/omega-market"].map((p) => fetch(p, { cache: "no-store" }).then((r) => r.status).catch(() => 0)));
    if (st.every((s) => s === 410)) return ok("Las dos responden 410");
    if (st.some((s) => s >= 200 && s < 300)) return fallo(`Respuestas ${st.join(", ")}: alguna parece ACTIVA`);
    return aviso(`Respuestas ${st.join(", ")} (se esperaba 410; no parecen activas)`);
  });
  add("Seguridad", "Estado de suscripción", async () => {
    const r = await authFetch("/api/omega-subscription/status");
    if (!r) return fallo("Sin sesión");
    return r.ok ? ok(`HTTP ${r.status}`) : aviso(`HTTP ${r.status}`);
  });

  // ----- Accesibilidad -----
  add("Accesibilidad", "Idioma y título de la página", async () => {
    const lang = document.documentElement.lang;
    const t = document.title;
    const d = `lang="${lang}" · título: «${t}»`;
    return lang.startsWith("es") && !/create next app/i.test(t) ? ok(d) : aviso(d);
  });
  add("Accesibilidad", "Subtítulos y menú de accesibilidad", async () => {
    const cap = !!document.querySelector(".omega-captions[aria-live]");
    const menu = !!document.querySelector(".omega-a11y-btn");
    const skip = !!document.querySelector(".omega-skip-link");
    const d = `subtítulos: ${cap ? "sí" : "no"} · menú ♿: ${menu ? "sí" : "no"} · saltar al contenido: ${skip ? "sí" : "no"}`;
    return cap && menu && skip ? ok(d) : fallo(d);
  });
  add("Accesibilidad", "Botones con acción", async () => {
    const els = Array.from(document.querySelectorAll("button, select"));
    const sin = els.filter((b) => {
      const k = Object.keys(b).find((x) => x.startsWith("__reactProps$"));
      const p = (k ? (b as unknown as Record<string, unknown>)[k] : {}) as Record<string, unknown>;
      const btn = b as HTMLButtonElement;
      return !(p.onClick || p.onChange || (btn.type === "submit" && btn.form));
    });
    if (!sin.length) return ok(`${els.length}/${els.length} controles con acción`);
    return fallo(`${sin.length} sin acción: ` + sin.slice(0, 5).map((b) => `«${(b.textContent || b.getAttribute("aria-label") || "?").trim().slice(0, 30)}»`).join(", "));
  });

  // ----- Rendimiento -----
  add("Rendimiento", "Última medición del supervisor", async () => {
    try {
      const h = JSON.parse(store("omega-supervisor-history-v1") ?? "[]") as { lcp?: number | null; inp?: number | null; fps?: number | null; modo?: string }[];
      const s = h[h.length - 1];
      if (!s) return info("Sin mediciones todavía (abre el Supervisor y espera 12 s)");
      const d = `modo ${s.modo ?? "?"} · carga ${Math.round(s.lcp ?? 0)} ms · respuesta ${Math.round(s.inp ?? 0)} ms · ${s.fps ?? "?"} FPS`;
      return (s.lcp ?? 0) < 2500 && (s.inp ?? 0) < 200 && (s.fps ?? 60) >= 45 ? ok(d) : aviso(d);
    } catch { return aviso("Historial del supervisor ilegible"); }
  });

  // ----- Motor de código (gasta créditos: solo con su botón) -----
  add("Motor de código", "Generación real con OpenRouter", async () => {
    const r = await adminFetch("/api/omega-admin/code", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "función que sume dos números", language: "typescript" }),
    });
    if (!r) return fallo("Sin sesión");
    const j = (await r.json().catch(() => ({}))) as { code?: string; model?: string; error?: string };
    if (!r.ok || !j.code) return fallo(`HTTP ${r.status} ${j.error ?? ""}`.trim());
    return ok(`${j.code.split("\n").length} líneas generadas con ${j.model ?? "?"}`);
  }, true);

  return list;
}

export default function OmegaDiagnostics() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [results, setResults] = useState<Record<string, Res & { running?: boolean }>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Pulsa «Ejecutar diagnóstico». No se ejecuta ninguna acción sensible.");
  const dlg = useRef<HTMLDialogElement>(null);
  const serverRef = useRef<Promise<ServerDiag | null> | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const r = await adminFetch("/api/omega-admin/status");
        const j = (r && r.ok ? await r.json() : null) as { role?: string } | null;
        if (alive) setIsAdmin(j?.role === "admin");
      } catch { if (alive) setIsAdmin(false); }
    };
    void check();
    const off = onAuthChange(() => { void check(); });
    return () => { alive = false; off(); };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        const d = dlg.current;
        if (d && !d.open) d.showModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAdmin]);

  const getServer = useCallback(() => {
    if (!serverRef.current) {
      serverRef.current = adminFetch("/api/omega-admin/diagnostics")
        .then(async (r) => (r && r.ok ? ((await r.json()) as ServerDiag) : null))
        .catch(() => null);
    }
    return serverRef.current;
  }, []);

  const checks = useMemo(() => buildChecks(getServer), [getServer]);

  const run = useCallback(async (only: Check[]) => {
    setBusy(true);
    serverRef.current = null;
    setStatus("Comprobando…");
    const out: Res[] = [];
    for (const c of only) {
      setResults((p) => ({ ...p, [c.id]: { estado: "info", detalle: "Comprobando…", running: true } }));
      let r: Res;
      try { r = await withTimeout(c.run(), 20000); } catch (e) { r = fallo(e instanceof Error ? e.message : "Error inesperado"); }
      out.push(r);
      setResults((p) => ({ ...p, [c.id]: r }));
    }
    const n = (e: Estado) => out.filter((x) => x.estado === e).length;
    const msg = `Terminado: ${n("ok")} correctas, ${n("aviso")} avisos, ${n("fallo")} fallos.`;
    setStatus(msg);
    feedback(msg, n("fallo") ? "error" : "ok");
    setBusy(false);
  }, []);

  if (!isAdmin) return null;

  const copiar = async () => {
    const lines = checks.filter((c) => results[c.id]).map((c) => `[${results[c.id].estado.toUpperCase()}] ${c.grupo} · ${c.nombre}: ${results[c.id].detalle}`);
    try {
      await navigator.clipboard.writeText(`===== DIAGNÓSTICO OMEGA ${new Date().toLocaleString("es-ES")} =====\n${lines.join("\n")}`);
      feedback("Informe de diagnóstico copiado.", "ok");
    } catch { feedback("No se pudo copiar el informe.", "error"); }
  };

  return (
    <>
      <button type="button" className="omega-diag-btn" aria-keyshortcuts="Alt+Shift+D" onClick={() => dlg.current?.showModal()}>
        <span aria-hidden="true">🩺</span> Diagnóstico
      </button>
      <dialog ref={dlg} className="omega-diag" aria-labelledby="omega-diag-title">
        <header className="omega-diag__head">
          <h2 id="omega-diag-title">Diagnóstico OMEGA · admin</h2>
          <button type="button" aria-label="Cerrar diagnóstico" onClick={() => dlg.current?.close()}>✕</button>
        </header>
        <div className="omega-diag__actions">
          <button type="button" disabled={busy} onClick={() => { void run(checks.filter((c) => !c.costoso)); }}>
            {busy ? "Comprobando…" : "Ejecutar diagnóstico"}
          </button>
          <button type="button" disabled={busy} onClick={() => { void run(checks.filter((c) => c.costoso)); }}>
            Probar motor de código (gasta créditos)
          </button>
          <button type="button" disabled={busy || !Object.keys(results).length} onClick={() => { void copiar(); }}>
            Copiar informe
          </button>
        </div>
        <p role="status" aria-live="polite" className="omega-diag__status">{status}</p>
        <div className="omega-diag__table">
          <table>
            <caption className="omega-sr-only">Resultado de cada comprobación</caption>
            <thead>
              <tr><th scope="col">Grupo</th><th scope="col">Función</th><th scope="col">Estado</th><th scope="col">Detalle</th><th scope="col"><span className="omega-sr-only">Acción</span></th></tr>
            </thead>
            <tbody>
              {checks.map((c) => {
                const r = results[c.id];
                return (
                  <tr key={c.id} data-estado={r?.estado ?? "pendiente"}>
                    <td>{c.grupo}</td>
                    <th scope="row">{c.nombre}{c.costoso ? " (gasta créditos)" : ""}</th>
                    <td className="omega-diag__estado">{r ? (r.running ? "⏳ …" : ICON[r.estado]) : "—"}</td>
                    <td>{r?.detalle ?? "Sin ejecutar"}</td>
                    <td>
                      <button type="button" disabled={busy} aria-label={`Repetir: ${c.nombre}`} onClick={() => { void run([c]); }}>Repetir</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  );
}