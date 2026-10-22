import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { omegaAdminGate } from "@/lib/omega-admin-access";

const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const FILE = join(process.cwd(), "omega-agent-v0.3", "logs", "omega-bridge-audit.jsonl");
const FIELDS = ["ts", "event", "app", "result", "consent", "ms", "jobId", "after"] as const;

/** Solo lectura. Admin verificado en servidor. Solo campos de una lista permitida; nunca mensajes ni claves. */
export async function GET(request: Request): Promise<Response> {
  try {
    const access = await omegaAdminGate(request, false);
    if (access.state !== "admin") return Response.json({ error: access.state }, { status: access.status, headers });
    // En Vercel no existe el registro local del PC: no se lee ningún archivo.
    if (process.env.VERCEL) return Response.json({ available: false, entries: [] }, { status: 200, headers });
    let raw = "";
    try {
      raw = await readFile(FILE, "utf8");
    } catch {
      return Response.json({ available: false, entries: [] }, { status: 200, headers });
    }
    const entries = raw.split(/\r?\n/).filter(Boolean).slice(-50).reverse().flatMap((line) => {
      try {
        const o: unknown = JSON.parse(line);
        if (!o || typeof o !== "object") return [];
        const src = o as Record<string, unknown>;
        const out: Record<string, string | number> = {};
        for (const k of FIELDS) {
          const v = src[k];
          if (typeof v === "string") out[k] = v.slice(0, 80);
          else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
        }
        return [out];
      } catch {
        return [];
      }
    });
    return Response.json({ available: true, entries }, { status: 200, headers });
  } catch {
    return Response.json({ error: "audit_failed" }, { status: 503, headers });
  }
}