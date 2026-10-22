import { omegaAdminGate } from "@/lib/omega-admin-access";

/**
 * OMEGA motor de código v1 (OpenRouter). Solo admin verificado en servidor.
 * Mismo origen, JSON, tamaño limitado, 20 peticiones / 10 min por usuario (por instancia).
 * Devuelve texto; NUNCA ejecuta el código generado.
 */
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const LANGS = ["typescript", "javascript", "python", "html", "css", "sql", "bash", "powershell", "json", "react"] as const;
const hits = new Map<string, number[]>();

function sameOrigin(req: Request): boolean {
  try {
    const origin = req.headers.get("origin");
    return !!origin && new URL(origin).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

function extractCode(text: string): string {
  const m = text.match(/```[a-zA-Z0-9_+-]*\n([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "origin_denied" }, { status: 403, headers });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    return Response.json({ error: "json_required" }, { status: 415, headers });
  try {
    const access = await omegaAdminGate(request, false);
    if (access.state !== "admin") return Response.json({ error: access.state }, { status: access.status, headers });

    const now = Date.now();
    const recent = (hits.get(access.userId) ?? []).filter((t) => now - t < 600_000);
    if (recent.length >= 20) return Response.json({ error: "rate_limited" }, { status: 429, headers });
    recent.push(now);
    hits.set(access.userId, recent);

    const raw = await request.text();
    if (raw.length > 8000) return Response.json({ error: "too_large" }, { status: 413, headers });
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return Response.json({ error: "invalid_json" }, { status: 400, headers }); }
    const { prompt, language } = (body ?? {}) as { prompt?: unknown; language?: unknown };
    if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > 4000)
      return Response.json({ error: "invalid_prompt" }, { status: 400, headers });
    const lang = LANGS.find((l) => l === language) ?? "typescript";

    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return Response.json({ error: "openrouter_not_configured" }, { status: 503, headers });
    const model = process.env.OMEGA_CODE_MODEL || "openrouter/auto";

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": new URL(request.url).origin,
        "X-Title": "OMEGA motor de codigo",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content:
              `Eres el motor de código de OMEGA. Responde SOLO con un bloque de código ${lang} completo y funcional, ` +
              "con comentarios breves en español. Sin explicaciones fuera del bloque. No incluyas claves, contraseñas " +
              "ni comandos destructivos (borrado masivo, formateo, desactivar seguridad).",
          },
          { role: "user", content: prompt.trim() },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      console.error("[OMEGA_CODE]", res.status, data.error?.message?.slice(0, 120));
      return Response.json({ error: res.status === 402 ? "openrouter_no_credits" : "openrouter_error" }, { status: 502, headers });
    }
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) return Response.json({ error: "empty_response" }, { status: 502, headers });
    return Response.json({ code: extractCode(text), language: lang, model: data.model ?? model }, { status: 200, headers });
  } catch {
    return Response.json({ error: "code_engine_unavailable" }, { status: 503, headers });
  }
}