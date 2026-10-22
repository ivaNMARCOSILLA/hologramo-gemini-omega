import { omegaAdminGate } from '@/lib/omega-admin-access';

/** Demonstrates privileged route protection: verified account + ADMIN + TOTP MFA. */
export async function GET(request: Request): Promise<Response> {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const gate = await omegaAdminGate(request, true);
    if (gate.state !== 'admin') return Response.json({ error: gate.state }, { status: gate.status, headers });
    return Response.json({ admin: true, mfaVerified: true, system: 'OMEGA' }, { status: 200, headers });
  } catch {
    return Response.json({ error: 'admin_check_failed' }, { status: 503, headers });
  }
}
