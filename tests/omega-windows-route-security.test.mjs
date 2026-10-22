import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Controles de seguridad de la ruta Windows actual (cola Supabase + puente con consentimiento local).
const src = readFileSync(fileURLToPath(new URL('../app/api/omega-windows/route.ts', import.meta.url)), 'utf8');

const required = {
  'mismo origen': /sameOrigin\(req\)/,
  'sesión verificada': /verified\(req\)/,
  'lista blanca de apps': /allowedApps\.some\(/,
  'límite de tamaño': /too_large/,
  'JSON obligatorio': /json_required/,
  'una acción a la vez': /another_action_in_progress/,
  'límite por hora': /hourly_action_limit/,
  'consentimiento local': /requiresLocalConsent:\s*true/,
};
for (const [name, re] of Object.entries(required)) {
  test(`omega-windows conserva: ${name}`, () => assert.match(src, re));
}
test('omega-windows no ejecuta procesos en el servidor', () => {
  assert.doesNotMatch(src, /child_process|\bexecSync?\(|\bspawn\(/);
});