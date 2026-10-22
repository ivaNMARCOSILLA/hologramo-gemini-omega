import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Rutas retiradas a propósito (README §0). Sustituye a los tests v0.6 de tests/retired/.
// Si alguien reactiva una ruta sin decisión explícita, este test falla.
for (const name of ['omega-market', 'omega-code']) {
  const file = fileURLToPath(new URL(`../app/api/${name}/route.ts`, import.meta.url));
  test(`${name} sigue retirada (HTTP 410)`, { skip: existsSync(file) ? false : 'no existe' }, () => {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /\b410\b/, `${name} ya no contiene 410: ¿se ha reactivado?`);
  });
}