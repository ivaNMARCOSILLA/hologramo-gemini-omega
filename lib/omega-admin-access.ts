import { createClient } from '@supabase/supabase-js';
import { verifiedUser } from '@/lib/omega-v09-server';

export type OmegaAdminGate =
  | { status: 200; state: 'admin'; userId: string; mfa: boolean }
  | { status: 401 | 403 | 503; state: 'unauthenticated' | 'not_admin' | 'mfa_required' | 'unavailable' };

/**
 * Verifies a Supabase access token SERVER-SIDE. Roles are read from a table
 * with RLS that users cannot write. Never trust UI state or user_metadata.
 * For privileged mutations use requireMfa=true AND check request origin.
 */
export async function omegaAdminGate(request: Request, requireMfa = true): Promise<OmegaAdminGate> {
  const user = await verifiedUser(request);
  if (!user) return { status: 401, state: 'unauthenticated' };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { status: 503, state: 'unavailable' };
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return { status: 401, state: 'unauthenticated' };

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase
    .from('omega_user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { status: 503, state: 'unavailable' }; // fail closed
  if (data?.role !== 'admin') return { status: 403, state: 'not_admin' };
  if (requireMfa && user.aal !== 'aal2') return { status: 403, state: 'mfa_required' };
  return { status: 200, state: 'admin', userId: user.id, mfa: user.aal === 'aal2' };
}
