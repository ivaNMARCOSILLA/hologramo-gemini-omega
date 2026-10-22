import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(join(process.cwd(), 'lib/omega-av-v07.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const route = mod.exports.routeVoiceShortcut;
for (const [utterance, section] of [
  ['ir a inicio', 'inicio'], ['abre menú de código', 'codigo'],
  ['ve a herramientas', 'herramientas'], ['mostrar avisos', 'avisos'],
  ['abre conocimiento', 'conocimiento'], ['muestra mis ideas', 'conocimiento'],
  ['abre IA avanzada', 'ia-avanzada'], ['ir a ajustes', 'ajustes'],
  ['abre menú acciones', 'acciones'],
]) test('navega: ' + utterance, () => assert.equal(route(utterance)?.section, section));
test('guarda una idea explícita', () => assert.deepEqual(route('guarda idea usar el PC por voz'), {kind:'idea',text:'usar el PC por voz'}));
for (const utterance of ['abre calculadora', 'programa un script PowerShell', 'borra mis archivos', 'revisa el ordenador', 'que hora es', ''])
  test('no intercepta orden: ' + utterance, () => assert.equal(route(utterance), null));
test('el panel comparte un único microfono y la escena se conserva', () => {
  const page = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8');
  const panel = readFileSync(join(process.cwd(), 'components/OmegaUnifiedPanel.tsx'), 'utf8');
  assert.equal((page.match(/new Recognition\(\)/g) || []).length,1);
  assert.match(page,/HologramScene/);
  // v1.1: 'omega:av-command' (v0.7) quedó sin emisor; navegación e ideas van por 'omega:unified-command'.
  assert.match(page,/dispatchEvent\(new CustomEvent\(\s*['"]omega:unified-command/); // emisor (voz)
  assert.match(panel,/addEventListener\(\s*['"]omega:unified-command['"]/); // receptor
  assert.match(page,/routeOmegaCommand\(/); // intérprete único v1.1
  assert.match(panel,/omega:voice-editor/);
  assert.match(panel,/omega:v07:ideas/);
});
test('las rutas de Windows y pago siguen restringidas', () => {
  const win=readFileSync(join(process.cwd(),'app/api/omega-windows/route.ts'),'utf8');
  const mkt=readFileSync(join(process.cwd(),'app/api/omega-market/route.ts'),'utf8');
  assert.match(win,/sameOrigin\(req\)/);
  assert.match(win,/verified\(req\)/);
  assert.match(mkt,/\b410\b/); // ruta retirada a propósito
});
