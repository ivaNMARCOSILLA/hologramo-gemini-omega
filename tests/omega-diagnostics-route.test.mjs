import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../app/api/omega-admin/diagnostics/route.ts', import.meta.url)), 'utf8');

test('diagnóstico exige administrador en servidor', () => assert.match(src, /omegaAdminGate\(request/));
test('diagnóstico solo informa de la existencia de variables', () => assert.match(src, /!!process\.env\[v\]/));
test('diagnóstico es solo lectura (solo GET)', () => {
  assert.match(src, /export async function GET/);
  assert.doesNotMatch(src, /export async function (POST|PUT|PATCH|DELETE)/);
});