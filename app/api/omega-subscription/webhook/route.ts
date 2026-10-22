import { adminClient, webReply } from '@/lib/omega-v09-server';
import { verifyStripeSignature } from '@/lib/omega-v09-stripe.mjs';
import { planById } from '@/lib/omega-v09-config';

type StripeSubscription = {
  id: string; customer?: string; status: string; metadata?: { omega_user_id?: string; omega_plan?: string };
  items?: { data?: Array<{ current_period_end?: number }> };
};
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return webReply({ error: 'Webhook sin configurar' }, 503);
  const size = Number(request.headers.get('content-length') || '0');
  if (size > 200_000) return webReply({ error: 'Payload demasiado grande' }, 413);
  const raw = await request.text();
  if (raw.length > 200_000 || !verifyStripeSignature(raw, request.headers.get('stripe-signature'), secret)) return webReply({ error: 'Firma Stripe inválida' }, 400);
  let event: { type: string; data: { object: StripeSubscription } };
  try { event = JSON.parse(raw); } catch { return webReply({ error: 'JSON inválido' }, 400); }
  if (!['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)) return webReply({ received: true });
  const sub = event.data.object;
  if (!sub?.id?.startsWith('sub_') || !sub.metadata?.omega_user_id || !/^[0-9a-f-]{36}$/i.test(sub.metadata.omega_user_id))
    return webReply({ error: 'Suscripción sin vínculo válido' }, 422);
  const plan = sub.metadata.omega_plan;
  if (!plan || !planById(plan)) return webReply({ error: 'Plan desconocido' }, 422);
  const db = adminClient();
  if (!db) return webReply({ error: 'Base de datos no configurada' }, 503);
  const period = sub.items?.data?.[0]?.current_period_end;
  const expires = typeof period === 'number' && Number.isSafeInteger(period) ? new Date(period*1000).toISOString() : null;
  const { error } = await db.from('omega_subscriptions').upsert({
    user_id: sub.metadata.omega_user_id, stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : null,
    plan, status: event.type === 'customer.subscription.deleted' ? 'canceled' : sub.status,
    period_end: expires, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) return webReply({ error: 'No se ha podido guardar la suscripción' }, 503);
  return webReply({ received: true });
}
