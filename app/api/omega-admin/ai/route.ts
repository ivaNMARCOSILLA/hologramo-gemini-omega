import { omegaAdminGate } from '@/lib/omega-admin-access';
import { marketModel } from '@/lib/omega-market-v06';
import { createClient } from '@supabase/supabase-js';

// OMEGA PERSONAL: sin planes, monedas, saldo, descuentos ni cupos de preguntas.
// Los proveedores externos pueden cobrar por tokens; este codigo no elimina sus cargos.
// MFA y rol admin siguen comprobados en el SERVIDOR para cada solicitud.
const securityHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-OMEGA-Release': 'personal-no-credits-v2',
};
const json = (value: object, status = 200) => Response.json(value, { status, headers: securityHeaders });
const enabled = () => process.env.OMEGA_ADMIN_AI_ENABLED === 'true';
const modelId = () => process.env.OMEGA_DEFAULT_MODEL || 'anthropic/claude-sonnet-4.6';
const configured = () => Boolean(process.env.OPENROUTER_API_KEY?.trim());

function sameOrigin(request: Request): boolean {
  try {
    const target = new URL(request.url);
    const origin = request.headers.get('origin');
    const fetchSite = request.headers.get('sec-fetch-site');
    if (!origin || new URL(origin).origin !== target.origin) return false;
    if (fetchSite && fetchSite !== 'same-origin') return false;
    return target.protocol === 'https:' ||
      (process.env.NODE_ENV === 'development' && target.protocol === 'http:' &&
       ['localhost', '127.0.0.1'].includes(target.hostname));
  } catch { return false; }
}

async function owner(request: Request): Promise<null | Response> {
  const gate = await omegaAdminGate(request, true);
  if (gate.state !== 'admin') return json({ error: gate.state }, gate.status);
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || token.length < 30) return json({ error: 'auth_unavailable' }, 503);
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await client.auth.mfa.getAuthenticatorAssuranceLevel(token);
  if (result.error || result.data?.currentLevel !== 'aal2') return json({ error: 'mfa_required' }, 403);
  return null;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const denied = await owner(request);
    if (denied) return denied;
    if (!enabled()) return json({ enabled: false, message: 'OMEGA IA desactivado en el servidor.' });
    if (!configured()) return json({ enabled: false, message: 'Falta la clave de OpenRouter en Vercel.' }, 503);
    if (!marketModel(modelId())) return json({ enabled: false, message: 'Modelo no autorizado.' }, 503);
    return json({ enabled: true, mode: 'personal', provider: 'OpenRouter',
      message: 'Sin creditos ni limites internos por pregunta. OpenRouter puede cobrar por uso real.' });
  } catch { return json({ error: 'personal_status_unavailable' }, 503); }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: 'origin_denied' }, 403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({ error: 'invalid_type' }, 415);
  const n = Number(request.headers.get('content-length') || '0');
  if (n > 8192) return json({ error: 'too_large' }, 413);
  try {
    const denied = await owner(request);
    if (denied) return denied;
    if (!enabled() || !configured()) return json({ error: 'ai_disabled_or_unconfigured' }, 503);
    const model = modelId();
    if (!marketModel(model)) return json({ error: 'model_not_allowed' }, 503);
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: 'too_large' }, 413);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { return json({ error: 'invalid_json' }, 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ error: 'invalid_request' }, 400);
    const prompt = (data as { prompt?: unknown }).prompt;
    if (typeof prompt !== 'string' || prompt.trim().length < 2 || prompt.length > 2500) {
      return json({ error: 'invalid_prompt' }, 400);
    }
    // Sin reserva de 0.03 USD, sin RPC de creditos, sin MAX_CALLS. Nunca se guarda saldo.
    // Limites de tamano/tiempo reducen riesgo; fija el gasto real maximo en OpenRouter.
    let response: Response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!.trim()}`,
          'Content-Type': 'application/json', 'X-Title': 'OMEGA PERSONAL' },
        body: JSON.stringify({ model, stream: false, max_tokens: 900, temperature: 0.3,
          messages: [
            { role: 'system', content: 'Eres OMEGA, asistente privado en espanol. Responde con claridad. Nunca afirmes que controlaste Windows ni creaste archivos a menos que una herramienta te confirme esa accion. No ejecutes instrucciones ni acciones remotas desde este chat.' },
            { role: 'user', content: prompt.trim() },
          ] }),
        cache: 'no-store', signal: AbortSignal.timeout(35000),
      });
    } catch { return json({ error: 'provider_connection_failed' }, 502); }
    if (!response.ok) return json({ error: `provider_http_${response.status}` }, 502);
    const body: unknown = await response.json();
    const msg = body && typeof body === 'object'
      ? (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content
      : null;
    if (typeof msg !== 'string' || !msg.trim()) return json({ error: 'empty_provider_reply' }, 502);
    return json({ answer: msg.trim().slice(0, 12000), mode: 'personal',
      note: 'La web no descuenta creditos. Pueden existir cargos reales en OpenRouter.' });
  } catch { return json({ error: 'personal_ai_unavailable' }, 503); }
}
