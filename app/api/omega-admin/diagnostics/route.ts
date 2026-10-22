import { omegaAdminGate } from "@/lib/omega-admin-access";

/**
 * OMEGA diagnóstico v1. SOLO LECTURA y solo admin (verificado en servidor).
 * De las variables de entorno solo informa si existen; nunca devuelve sus valores.
 */
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const VARS = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "OPENROUTER_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "OMEGA_CODE_MODEL", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_OMEGA_BILLING_ENABLED",
];

type OpenRouterInfo = { ok: boolean; detail: string; usage?: number | null; limit?: number | null; remaining?: number | null };

export async function GET(request: Request): Promise<Response> {
  try {
    const access = await omegaAdminGate(request, false);
    if (access.state !== "admin") return Response.json({ error: access.state }, { status: access.status, headers });

    const env: Record<string, boolean> = Object.fromEntries(VARS.map((v) => [v, !!process.env[v]]));
    const runtime = {
      vercel: !!process.env.VERCEL,
      region: process.env.VERCEL_REGION ?? null,
      node: process.version,
      env: process.env.NODE_ENV ?? "desconocido",
    };
    const model = process.env.OMEGA_CODE_MODEL || "openrouter/auto";

    let openrouter: OpenRouterInfo = { ok: false, detail: "OPENROUTER_API_KEY no definida" };
    const key = process.env.OPENROUTER_API_KEY;
    if (key) {
      try {
        const r = await fetch("https://openrouter.ai/api/v1/key", {
          headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
        });
        const j = (await r.json().catch(() => ({}))) as { data?: { usage?: number; limit?: number | null; limit_remaining?: number | null } };
        openrouter = r.ok
          ? { ok: true, detail: "Clave válida", usage: j.data?.usage ?? null, limit: j.data?.limit ?? null, remaining: j.data?.limit_remaining ?? null }
          : { ok: false, detail: r.status === 401 ? "Clave rechazada por OpenRouter (401)" : `OpenRouter respondió HTTP ${r.status}` };
      } catch {
        openrouter = { ok: false, detail: "OpenRouter no responde (timeout o red)" };
      }
    }
    return Response.json({ mfa: access.mfa, runtime, env, openrouter, model }, { status: 200, headers });
  } catch {
    return Response.json({ error: "diagnostics_failed" }, { status: 503, headers });
  }
}