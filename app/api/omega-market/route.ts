// OMEGA PERSONAL: mercado IA antiguo clausurado.
// No se mantienen reservas de creditos ni acceso a OpenRouter por esta ruta.
// El laboratorio privado autorizado esta en /omega-personal (ADMIN + MFA).
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-OMEGA-Release': 'personal-no-credits-v3',
};
const disabled = () => Response.json(
  { error: 'legacy_market_disabled', message: 'Mercado antiguo desactivado. Usa /omega-personal.' },
  { status: 410, headers },
);
export async function GET(): Promise<Response> { return disabled(); }
export async function POST(): Promise<Response> { return disabled(); }
