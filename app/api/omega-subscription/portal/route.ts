import { acceptedOrigin, adminClient, verifiedUser, webReply } from '@/lib/omega-v09-server';
import { billingConfigured } from '@/lib/omega-v09-config';

export async function POST(request: Request) {
  if (!acceptedOrigin(request)) return webReply({ error: 'Origen no autorizado' }, 403);
  if (!billingConfigured()) return webReply({ error: 'Facturación no configurada' }, 503);
  const user = await verifiedUser(request);
  if (!user) return webReply({ error: 'Acceso no autorizado' }, 401);
  const db = adminClient();
  if (!db) return webReply({ error: 'Base de datos no disponible' }, 503);
  const { data, error } = await db.from('omega_subscriptions')
    .select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (error || !data?.stripe_customer_id?.startsWith('cus_')) return webReply({ error: 'No hay una suscripción administrable.' }, 404);
  const site = process.env.OMEGA_SITE_URL?.replace(/\/$/, '');
  if (!site || !site.startsWith('https://')) return webReply({ error:'Dominio pendiente de configurar' }, 503);
  try {
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ customer:data.stripe_customer_id, return_url:site }).toString(),
      cache:'no-store', signal: AbortSignal.timeout(12000),
    });
    const result = await res.json() as { url?: string };
    if (!res.ok || !result.url) return webReply({ error:'El portal de suscripciones no está disponible.' }, 502);
    const u=new URL(result.url);
    if (u.protocol!=='https:' || u.hostname!=='billing.stripe.com') return webReply({ error:'Destino no autorizado' }, 502);
    return webReply({ url:result.url });
  } catch { return webReply({ error:'No se pudo conectar al portal de suscripciones.' }, 502); }
}
