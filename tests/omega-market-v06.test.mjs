import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const project = process.cwd();
const code = readFileSync(join(project, 'lib/omega-market-v06.ts'), 'utf8');
const transpiled = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = await import('data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64'));

test('catalogo cerrado de modelos especializados', () => {
  assert.equal(m.OMEGA_MODELS.length, 3);
  assert.equal(m.marketModel('openai/gpt-5.5')?.id, 'openai/gpt-5.5');
  assert.equal(m.marketModel('any/rogue'), undefined);
});
test('costes estimados no aceptan valores imposibles', () => {
  assert.equal(m.estimatedDollars('google/gemini-3.1-pro-preview', 1_000_000, 1_000_000), 14);
  assert.throws(() => m.estimatedDollars('unknown', 10, 10));
  assert.throws(() => m.estimatedDollars('openai/gpt-5.5', -1, 10));
});
test('limite y mes validos', () => {
  assert.equal(m.parseMonthlyLimit('5'), 5);
  assert.equal(m.parseMonthlyLimit('-2'), 5);
  assert.equal(m.monthKey(new Date('2026-10-21T00:00:00Z')), '2026-10');
});
test('prohibe web publica, peticiones de otro origen y POST sin permiso de origen', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const get = (host) => new Request('http://127.0.0.1:3000/api/omega-market', { headers: { host } });
    assert.equal(m.permittedMarketRequest(get('127.0.0.1:3000')), true);
    assert.equal(m.permittedMarketRequest(get('hologramo.es')), false);
    const post = (origin, fetchSite = 'same-origin') => new Request('http://127.0.0.1:3000/api/omega-market', {
      method: 'POST', headers: { host: '127.0.0.1:3000', origin, 'sec-fetch-site': fetchSite, 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(m.permittedMarketRequest(post('http://127.0.0.1:3000')), true);
    assert.equal(m.permittedMarketRequest(post('https://evil.example')), false);
    assert.equal(m.permittedMarketRequest(post('http://127.0.0.1:3000', 'cross-site')), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
test('produccion no habilita peticiones aunque sea localhost', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const request = new Request('http://127.0.0.1:3000/api/omega-market', { headers: { host: '127.0.0.1:3000' } });
    assert.equal(m.permittedMarketRequest(request), false);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
