import { adminClient, verifiedUser, webReply } from '@/lib/omega-v09-server';

export async function GET(request: Request) {
  const user = await verifiedUser(request);
  if (!user) return webReply({ error: 'Sesión no autorizada' }, 401);
  const supabase = adminClient();
  if (!supabase) return webReply({ status: 'sin configurar', plan: null, expiresAt: null });
  const { data, error } = await supabase.from('omega_subscriptions')
    .select('plan,status,period_end').eq('user_id', user.id).maybeSingle();
  if (error) return webReply({ error: 'Estado de suscripción no disponible' }, 503);
  return webReply({ plan: data?.plan || null, status: data?.status || 'inactiva', expiresAt: data?.period_end || null });
}
