import { omegaAdminGate } from '@/lib/omega-admin-access';
import { adminClient } from '@/lib/omega-v09-server';

// OMEGA Windows Bridge: panel ADMIN + MFA. El navegador nunca recibe la clave del agente.
// No añadir runtime/dynamic: compatibilidad con Next 16 + cacheComponents.
const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reply = (data: object, status = 200) => Response.json(data, { status, headers });
const allowedApps = ['notepad', 'calculator', 'explorer', 'paint', 'snipping', 'edge', 'chrome', 'settings', 'word', 'excel', 'powerpoint', 'vscode'] as const;

function sameOrigin(req: Request) {
  try {
    const origin = req.headers.get('origin');
    const dest = new URL(req.url);
    return !!origin && new URL(origin).origin === dest.origin &&
      (!req.headers.get('sec-fetch-site') || req.headers.get('sec-fetch-site') === 'same-origin') &&
      (dest.protocol === 'https:' || (process.env.NODE_ENV === 'development' &&
        dest.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(dest.hostname)));
  } catch { return false; }
}

async function verified(req: Request) {
  const gate = await omegaAdminGate(req, true);
  if (gate.state !== 'admin') return { denied: reply({ error: gate.state }, gate.status), userId: '' };
  return { denied: null, userId: gate.userId };
}

export async function GET(req: Request): Promise<Response> {
  try {
    const { denied, userId } = await verified(req);
    if (denied) return denied;
    const db = adminClient();
    if (!db) return reply({ error: 'database_not_configured' }, 503);
    const [{ data: agent, error: heartbeatError }, { data: jobs, error: jobsError }] = await Promise.all([
      db.from('omega_windows_agent_status').select('last_seen_at,version').eq('name', 'primary').maybeSingle(),
      db.from('omega_windows_jobs').select('id,app,status,created_at,finished_at,result_text')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    ]);
    if (heartbeatError || jobsError) {
      console.error('[OMEGA_WINDOWS_STATUS]', heartbeatError?.code || jobsError?.code || 'unknown');
      return reply({ error: 'bridge_database_unavailable' }, 503);
    }
    const online = !!agent?.last_seen_at && Date.now() - Date.parse(agent.last_seen_at) < 40_000;
    return reply({ enabled: true, connected: online, agentVersion: agent?.version || null, jobs: jobs || [],
      apps: allowedApps, requiresLocalConsent: true });
  } catch {
    return reply({ error: 'bridge_status_unavailable' }, 503);
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!sameOrigin(req)) return reply({ error: 'origin_denied' }, 403);
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return reply({ error: 'json_required' }, 415);
  if (Number(req.headers.get('content-length') || '0') > 1024) return reply({ error: 'too_large' }, 413);
  try {
    const { denied, userId } = await verified(req);
    if (denied) return denied;
    const raw = await req.text();
    if (raw.length > 1024) return reply({ error: 'too_large' }, 413);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return reply({ error: 'invalid_json' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return reply({ error: 'invalid_request' }, 400);
    const { app } = body as { app?: unknown };
    if (typeof app !== 'string' || !allowedApps.some(a => a === app)) return reply({ error: 'app_not_allowed' }, 403);
    const db = adminClient();
    if (!db) return reply({ error: 'database_not_configured' }, 503);
    const { data: agent, error: agentError } = await db.from('omega_windows_agent_status')
      .select('last_seen_at').eq('name', 'primary').maybeSingle();
    if (agentError) return reply({ error: 'bridge_database_unavailable' }, 503);
    if (!agent?.last_seen_at || Date.now() - Date.parse(agent.last_seen_at) >= 40_000)
      return reply({ error: 'windows_agent_offline' }, 409);
    const since = new Date(Date.now() - 3_600_000).toISOString();
    const [{ data: active, error: activeError }, { count, error: countError }] = await Promise.all([
      db.from('omega_windows_jobs').select('id').eq('user_id', userId)
        .in('status', ['pending', 'running']).gt('expires_at', new Date().toISOString()).limit(1),
      db.from('omega_windows_jobs').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gte('created_at', since),
    ]);
    if (activeError || countError) return reply({ error: 'bridge_database_unavailable' }, 503);
    if ((active || []).length) return reply({ error: 'another_action_in_progress' }, 409);
    if ((count || 0) >= 12) return reply({ error: 'hourly_action_limit' }, 429);
    const { data: row, error } = await db.from('omega_windows_jobs')
      .insert({ user_id: userId, app, status: 'pending' })
      .select('id,app,status,created_at').single();
    if (error) { console.error('[OMEGA_WINDOWS_ENQUEUE]', error.code); return reply({ error: 'enqueue_failed' }, 503); }
    return reply({ ok: true, job: row, message: 'Solicitud enviada; requiere consentimiento en Windows.' }, 202);
  } catch {
    return reply({ error: 'bridge_action_unavailable' }, 503);
  }
}
