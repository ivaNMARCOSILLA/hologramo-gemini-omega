/** OMEGA v0.9: public catalogue only. Secret values never belong here. */
export const OMEGA_PLANS = [
  { id: 'elite', name: 'OMEGA ELITE', amountEurYear: 499, description: 'Interfaz avanzada y asistencia personal' },
  { id: 'studio', name: 'OMEGA STUDIO', amountEurYear: 1499, description: 'Espacios de trabajo y flujos profesionales' },
  { id: 'sovereign', name: 'OMEGA SOVEREIGN', amountEurYear: 4999, description: 'Servicio y soporte de alto nivel; sujeto a contratación' },
] as const;
export type OmegaPlanId = (typeof OMEGA_PLANS)[number]['id'];
export function planById(id: string) { return OMEGA_PLANS.find(p => p.id === id); }
export function billingConfigured() {
  return process.env.OMEGA_BILLING_ENABLED === 'true' && !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}
export const priceEnv: Record<OmegaPlanId, string> = { elite: 'STRIPE_PRICE_ELITE_YEAR', studio: 'STRIPE_PRICE_STUDIO_YEAR', sovereign: 'STRIPE_PRICE_SOVEREIGN_YEAR' };
