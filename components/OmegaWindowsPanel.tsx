"use client";

import { useEffect, useState } from "react";

type AgentStatus = { agent?: string; version?: string; mode?: string; consent?: string; error?: string };
type SystemDiagnostics = {
  system: string; osVersion: string; kernel: string; architecture: string;
  logicalProcessors: number; ramGB: number; availableRamGB: number; privilege: string;
};

export default function OmegaWindowsPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [command, setCommand] = useState("abre bloc de notas");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);

  async function refresh() {
    try {
      const response = await fetch("/api/omega-windows", { cache: "no-store" });
      const result: AgentStatus = await response.json();
      setStatus(response.ok ? result : { error: result.error || "Desconectado" });
    } catch { setStatus({ error: "No disponible" }); }
  }
  useEffect(() => { if (visible) void refresh(); }, [visible]);

  async function inspectWindows() {
    setLoading(true);
    setMessage("Consultando el sistema sin hacer cambios...");
    try {
      const response = await fetch("/api/omega-windows?diagnostics=1", { cache: "no-store" });
      const result: SystemDiagnostics & { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      setDiagnostics(result);
      setMessage("Diagnostico Windows completado (solo lectura).");
    } catch (error) {
      setMessage(`Diagnostico no disponible: ${error instanceof Error ? error.message : "error de conexion"}`);
    } finally { setLoading(false); }
  }

  async function send(action: "open" | "disarm") {
    setLoading(true);
    setMessage(action === "open" ? "Esperando autorización en la ventana de Windows..." : "Deteniendo permisos...");
    try {
      const response = await fetch("/api/omega-windows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "open" ? { command: "open", text: command } : { command: "disarm" }),
      });
      const result = await response.json();
      setMessage(response.ok ? (result.message || "Accion completada") : (`Accion rechazada (HTTP ${response.status}): ${result.error || "Operacion rechazada"}`));
      void refresh();
    } catch { setMessage("No se pudo comunicar con OMEGA Windows Agent."); }
    finally { setLoading(false); }
  }

  return (
    <section aria-label="OMEGA Windows Agent" className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-auto">
      <button type="button" onClick={() => setVisible((value) => !value)}
        className="rounded-xl border border-cyan-400 bg-slate-950 px-4 py-2 text-xs font-bold text-cyan-200 shadow-lg">
        {visible ? "Cerrar control Windows" : "OMEGA · CONTROL WINDOWS"}
      </button>
      {visible && (
        <div className="w-[min(360px,calc(100vw-24px))] rounded-xl border border-cyan-500/60 bg-slate-950/95 p-4 text-white shadow-2xl">
          <p className="mb-2 text-sm font-bold text-cyan-300">Control local supervisado</p>
          <p className="mb-3 text-xs text-slate-300">{status?.error ? status.error : status?.agent ? `${status.agent} ${status.version} · conectado` : "Comprobando conexión..."}</p>
          <label htmlFor="omega-local-command" className="mb-1 block text-xs text-slate-300">Orden para Windows</label>
          <input id="omega-local-command" className="w-full rounded-md border border-cyan-500/50 bg-black p-2 text-sm text-white"
            value={command} maxLength={180} onChange={(event) => setCommand(event.target.value)}
            placeholder="abre bloc de notas" disabled={loading} />
          <p className="my-2 text-xs text-slate-400">Órdenes: abre bloc de notas, abre calculadora, abre explorador.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={loading} onClick={() => void send("open")}
              className="rounded-md bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Solicitar acción</button>
            <button type="button" disabled={loading} onClick={() => void send("disarm")}
              className="rounded-md border border-rose-500 px-3 py-2 text-xs text-rose-200 disabled:opacity-50">Desautorizar</button>
            <button type="button" disabled={loading} onClick={() => void refresh()}
              className="rounded-md border border-slate-500 px-3 py-2 text-xs text-slate-200">Estado</button>
            <button type="button" disabled={loading} onClick={() => void inspectWindows()}
              className="rounded-md border border-cyan-500 px-3 py-2 text-xs text-cyan-200">Diagnostico Windows</button>
          </div>
          {message && <p className="mt-3 text-xs text-cyan-200" role="status">{message}</p>}
          {diagnostics && (
            <div className="mt-3 rounded border border-cyan-700/50 bg-slate-900 p-2 text-xs text-slate-200" role="region" aria-label="Diagnostico local de Windows">
              <p><strong>Sistema:</strong> {diagnostics.system} · {diagnostics.osVersion}</p>
              <p><strong>Nucleo:</strong> {diagnostics.kernel} · {diagnostics.architecture}</p>
              <p><strong>CPU:</strong> {diagnostics.logicalProcessors} procesadores logicos</p>
              <p><strong>RAM:</strong> {diagnostics.availableRamGB} GB libres de {diagnostics.ramGB} GB</p>
              <p className="mt-1 text-cyan-200">{diagnostics.privilege}</p>
            </div>
          )}
          <p className="mt-3 text-[11px] text-slate-400">Cada apertura necesita una confirmación independiente de Windows. Solo funciona en localhost durante desarrollo; no funciona desde Vercel.</p>
        </div>
      )}
    </section>
  );
}
