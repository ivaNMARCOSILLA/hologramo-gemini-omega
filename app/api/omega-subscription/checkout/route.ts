// OMEGA PERSONAL - Punto de entrada de nuevos pagos permanentemente deshabilitado.
// Conserva historial de Stripe/webhooks por integridad: no borrar pagos ni cancelar contratos ajenos.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'OMEGA es de uso personal. Nuevas suscripciones deshabilitadas.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  return NextResponse.json(
    { error: 'OMEGA es de uso personal. Nuevas suscripciones deshabilitadas.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
