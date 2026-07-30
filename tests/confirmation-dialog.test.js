import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('el diálogo declara semántica modal, cancelación por Escape y bloqueo de doble resolución',async()=>{
  const source=await readFile('src/confirmation-dialog.js','utf8');
  assert.match(source,/aria-labelledby/);assert.match(source,/aria-describedby/);assert.match(source,/showModal\(\)/);
  assert.match(source,/addEventListener\('cancel'/);assert.match(source,/if\(settled\)return/);assert.match(source,/removeEventListener/);
});
test('la sustitución usa etiquetas específicas y no confirmación nativa',async()=>{
  const source=await readFile('script.js','utf8');
  const flow=source.slice(source.indexOf('async function applyPreviousSubarea'),source.indexOf('function undoPreviousSubarea'));
  assert.match(flow,/Sustituir puntuaciones/);assert.match(flow,/cancelLabel:'Cancelar'/);assert.doesNotMatch(flow,/\bconfirm\s*\(/);
});
test('el CSS apila acciones en móvil y respeta movimiento reducido',async()=>{
  const css=await readFile('styles.css','utf8');assert.match(css,/@media\(max-width:520px\)[^\n]*\.confirmation-dialog__actions\{[^}]*flex-direction:column/s);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);assert.match(css,/\.confirmation-dialog\{scroll-behavior:auto;transition:none;animation:none\}/);
});
