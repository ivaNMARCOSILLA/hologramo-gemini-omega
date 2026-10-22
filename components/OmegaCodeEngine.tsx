"use client";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, onAuthChange } from "../lib/omega-admin-fetch";
import { feedback } from "../lib/omega-a11y-feedback";

/** OMEGA motor de código v1: genera código con OpenRouter (vía servidor). Solo admin. Nunca lo ejecuta. */
const LANGS = ["typescript", "javascript", "python", "html", "css", "sql", "bash", "powershell", "json", "react"];
const EXT: Record<string, string> = { typescript: "ts", javascript: "js", python: "py", html: "html", css: "css", sql: "sql", bash: "sh", powershell: "ps1", json: "json", react: "tsx" };
const ERR: Record<string, string> = {
  openrouter_not_configured: "Falta OPENROUTER_API_KEY en el servidor (Vercel > Environment Variables).",
  openrouter_no_credits: "OpenRouter sin créditos.",
  rate_limited: "Límite de 20 peticiones cada 10 minutos.",
  unauthenticated: "Inicia sesión como administrador.",
  not_admin: "Solo el administrador puede usar el motor de código.",
  origin_denied: "Usa el dominio hologramo.es.",
};

export function detectLanguage(text: string): string {
  const t = text.toLowerCase();
  if (/\bpython\b/.test(t)) return "python";
  if (/\breact\b|\bcomponente\b/.test(t)) return "react";
  if (/\bhtml\b|\bp[aá]gina web\b/.test(t)) return "html";
  if (/\bcss\b|\bestilos?\b/.test(t)) return "css";
  if (/\bsql\b|\bconsulta\b/.test(t)) return "sql";
  if (/\bpowershell\b/.test(t)) return "powershell";
  if (/\bbash\b|\bterminal linux\b/.test(t)) return "bash";
  if (/\bjavascript\b/.test(t)) return "javascript";
  if (/\bjson\b/.test(t)) return "json";
  return "typescript";
}

export default function OmegaCodeEngine() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [lang, setLang] = useState("typescript");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("Listo. Di «programa una función que…» o escribe aquí.");
  const [busy, setBusy] = useState(false);

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

  const generate = useCallback(async (text: string, language: string) => {
    const p = text.trim();
    if (p.length < 3) return;
    setOpen(true); setBusy(true); setPrompt(p); setLang(language);
    setStatus("Generando código con OpenRouter…");
    feedback("Generando código.", "info");
    try {
      const r = await adminFetch("/api/omega-admin/code", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: p, language }),
      });
      if (!r) { setStatus(ERR.unauthenticated); feedback(ERR.unauthenticated, "error"); return; }
      const j = (await r.json().catch(() => ({}))) as { code?: string; model?: string; error?: string };
      if (!r.ok || !j.code) {
        const msg = ERR[j.error ?? ""] ?? `No se pudo generar (${j.error ?? r.status}).`;
        setStatus(msg); feedback(msg, "error"); return;
      }
      setCode(j.code);
      setStatus(`Código ${language} generado (${j.code.split("\n").length} líneas, modelo ${j.model ?? "?"}). No se ha ejecutado.`);
      feedback("Código generado. Revísalo antes de usarlo.", "ok");
    } catch {
      setStatus("Sin conexión con el servidor."); feedback("Sin conexión con el servidor.", "error");
    } finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const onGen = (e: Event) => {
      const t = (e as CustomEvent<unknown>).detail;
      if (typeof t === "string") void generate(t, detectLanguage(t));
    };
    window.addEventListener("omega:code-generate", onGen);
    window.addEventListener("omega:voice-code", onGen);
    return () => {
      window.removeEventListener("omega:code-generate", onGen);
      window.removeEventListener("omega:voice-code", onGen);
    };
  }, [isAdmin, generate]);

  if (!isAdmin) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); feedback("Código copiado.", "ok"); }
    catch { feedback("No se pudo copiar.", "error"); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `omega-codigo.${EXT[lang] ?? "txt"}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className="omega-code-engine" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Motor de código · OpenRouter</summary>
      <div className="omega-code-engine__body">
        <label htmlFor="omega-code-prompt">Qué quieres programar</label>
        <textarea id="omega-code-prompt" rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ej.: una función en python que ordene una lista de nombres" />
        <div className="omega-code-engine__row">
          <label htmlFor="omega-code-lang" className="omega-sr-only">Lenguaje</label>
          <select id="omega-code-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <button type="button" disabled={busy || prompt.trim().length < 3} onClick={() => { void generate(prompt, lang); }}>
            {busy ? "Generando…" : "Generar"}
          </button>
          <button type="button" disabled={!code} onClick={() => { void copy(); }}>Copiar</button>
          <button type="button" disabled={!code} onClick={download}>Descargar</button>
        </div>
        <p role="status" aria-live="polite" className="omega-code-engine__status">{status}</p>
        {code && <pre className="omega-code-engine__out" tabIndex={0} aria-label="Código generado"><code>{code}</code></pre>}
      </div>
    </details>
  );
}