import { createClient } from '@supabase/supabase-js';

export type OmegaUser = { id: string; email?: string; aal: string };
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
}
export async function verifiedUser(request: Request): Promise<OmegaUser | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const auth = request.headers.get('authorization');
  if (!url || !key || !auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (token.length < 30 || token.length > 8192) return null;
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at) return null;
  // Solo se confían claims del JWT DESPUÉS de verificarlo con Supabase Auth.
  let aal = 'aal1';
  try {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as { sub?: string; aal?: string };
    if (claims.sub === data.user.id && claims.aal === 'aal2') aal = 'aal2';
  } catch { /* token ya autenticado, nivel 1 por defecto */ }
  return { id: data.user.id, email: data.user.email, aal };
}
export function acceptedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const a = new URL(origin);
    const b = new URL(request.url);
    const configured = process.env.OMEGA_SITE_URL?.replace(/\/$/, '');
    if (a.origin !== b.origin || (configured && a.origin !== configured)) return false;
    return (a.protocol === 'https:' || (process.env.NODE_ENV === 'development' && ['127.0.0.1','localhost'].includes(a.hostname)));
  } catch { return false; }
}
export function webReply(payload: object, status = 200): Response {
  return Response.json(payload, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options':'nosniff' } });
}
