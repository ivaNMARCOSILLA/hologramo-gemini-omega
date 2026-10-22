import { omegaAdminGate } from '@/lib/omega-admin-access';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
/** Read-only. Token verified and admin role checked on every request. */
export async function GET(request: Request): Promise<Response> {
  try {
    const access = await omegaAdminGate(request, false);
    if (access.state === 'admin') return Response.json({ role: 'admin', mfa: access.mfa, canManage: access.mfa }, { status: 200, headers });
    return Response.json({ role: 'member', error: access.state }, { status: access.status, headers });
  } catch {
    return Response.json({ error: 'admin_check_failed' }, { status: 503, headers });
  }
}
