import { timingSafeEqual } from 'node:crypto';
import { adminClient } from '@/lib/omega-v09-server';

// Canal HTTPS servidor <-> agente Windows. Nunca exponemos clave o service_role en el navegador.
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (data: object, status = 200) => Response.json(data, { status, headers });

function authorized(req: Request) {
  const expected = process.env.OMEGA_WINDOWS_BRIDGE_SECRET?.trim();
  const given = req.headers.get('x-omega-bridge-key');
  if (!expected || !/^[0-9a-f]{64}$/.test(expected) || !given || !/^[0-9a-f]{64}$/.test(given)) return false;
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(given, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request): Promise<Response> {
  if (!authorized(req)) return reply({ error: 'unauthorized' }, 401);
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return reply({ error: 'json_required' }, 415);
  if (Number(req.headers.get('content-length') || '0') > 2048) return reply({ error: 'too_large' }, 413);
  try {
    const raw = await req.text();
    if (raw.length > 2048) return reply({ error: 'too_large' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid_json' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'invalid_request' }, 400);
    const payload = body as Record<string, unknown>;
    const db = adminClient();
    if (!db) return reply({ error: 'database_not_configured' }, 503);

    if (payload.action === 'poll') {
      const now = new Date().toISOString();
      const { error: heartbeatError } = await db.from('omega_windows_agent_status').upsert({
        name: 'primary', last_seen_at: now, version: 'bridge-1.0',
      }, { onConflict: 'name' });
      if (heartbeatError) return reply({ error: 'heartbeat_failed' }, 503);
      // Expirar solicitudes abandonadas. El agente solo ejecuta trabajos vigentes.
      const { error: expireError } = await db.from('omega_windows_jobs')
        .update({ status: 'expired', finished_at: now, result_text: 'Tiempo de espera agotado.' })
        .in('status', ['pending', 'running']).lt('expires_at', now);
      if (expireError) return reply({ error: 'queue_unavailable' }, 503);
      const { data: first, error } = await db.from('omega_windows_jobs')
        .select('id,app').eq('status', 'pending').gt('expires_at', now)
        .order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (error) return reply({ error: 'queue_unavailable' }, 503);
      if (!first) return reply({ ok: true, job: null });
      // Reclamar por cambio de estado condicional (un solo agente trabaja cada solicitud).
      const { data: claimed, error: claimError } = await db.from('omega_windows_jobs')
        .update({ status: 'running', started_at: now })
        .eq('id', first.id).eq('status', 'pending').gt('expires_at', now)
        .select('id,app').maybeSingle();
      if (claimError) return reply({ error: 'queue_unavailable' }, 503);
      return reply({ ok: true, job: claimed || null });
    }
    if (payload.action === 'finish') {
      const jobId = payload.jobId;
      const result = payload.result;
      if (typeof jobId !== 'string' || !/^[0-9a-f-]{36}$/i.test(jobId) ||
          !['completed', 'denied', 'failed'].includes(String(result)))
        return reply({ error: 'invalid_result' }, 400);
      const message = typeof payload.message === 'string' ? payload.message.slice(0, 220) : '';
      const { data, error } = await db.from('omega_windows_jobs')
        .update({ status: result as 'completed' | 'denied' | 'failed',
          result_text: message, finished_at: new Date().toISOString() })
        .eq('id', jobId).eq('status', 'running').gt('expires_at', new Date().toISOString())
        .select('id').maybeSingle();
      if (error) return reply({ error: 'result_update_failed' }, 503);
      if (!data) return reply({ error: 'job_expired_or_finished' }, 409);
      return reply({ ok: true });
    }
    return reply({ error: 'unknown_action' }, 400);
  } catch {
    return reply({ error: 'bridge_agent_unavailable' }, 503);
  }
}
