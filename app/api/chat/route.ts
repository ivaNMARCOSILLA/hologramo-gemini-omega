import { omegaAdminGate } from '@/lib/omega-admin-access';
import { POST as personalChat } from '@/app/api/omega-admin/ai/route';

// Compatibilidad con clientes /api/chat. No existe chat publico gastando clave privada.
// Para usarlo se exige token ADMIN con MFA; la pagina /omega-personal lo gestiona.
export async function POST(request: Request): Promise<Response> {
  const gate = await omegaAdminGate(request, true);
  if (gate.state !== 'admin') return Response.json({ error: 'private_personal_access_only' },
    { status: gate.status, headers: { 'Cache-Control': 'private, no-store' } });
  let data: unknown;
  try { data = await request.json(); } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
  const prompt = data && typeof data === 'object' && !Array.isArray(data)
    ? (data as { prompt?: unknown }).prompt : undefined;
  if (typeof prompt !== 'string' || prompt.trim().length < 2 || prompt.length > 2500) {
    return Response.json({ error: 'invalid_prompt' }, { status: 400 });
  }
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.delete('content-length');
  const proxied = new Request(request.url, { method: 'POST', headers: forwardHeaders,
    body: JSON.stringify({ prompt }) });
  const response = await personalChat(proxied);
  const result: unknown = await response.json();
  const payload = result && typeof result === 'object' ? result as { answer?: string; error?: string } : {};
  if (!response.ok) return Response.json({ reply: '', error: payload.error || 'ai_error' }, { status: response.status });
  return Response.json({ reply: payload.answer || '', engine: 'OMEGA PERSONAL' },
    { headers: { 'Cache-Control': 'private, no-store' } });
}
