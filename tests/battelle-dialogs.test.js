import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('el diálogo común es modal, asocia título y descripción y resuelve una sola vez', async () => {
  const source = await readFile('src/battelle-dialogs.js', 'utf8');
  assert.match(source, /createElement\('dialog'\)/); assert.match(source, /aria-labelledby/); assert.match(source, /aria-describedby/); assert.match(source, /showModal\(\)/);
  assert.match(source, /addEventListener\('cancel'/); assert.match(source, /if \(settled\) return/); assert.match(source, /cleanup\(\)/);
  assert.match(source, /event\.key !== 'Tab'/); assert.match(source, /trigger\?\.isConnected/); assert.doesNotMatch(source, /innerHTML/);
});
test('las confirmaciones enfocan Cancelar, bloquean doble ejecución y muestran error persistente', async () => {
  const source = await readFile('src/battelle-dialogs.js', 'utf8'); assert.match(source, /\(cancel \?\? primary\)\.focus\(\)/); assert.match(source, /if \(working \|\| settled\) return/); assert.match(source, /await options\.onConfirm\(\)/); assert.match(source, /error\.hidden = false/);
});
test('papelera, restauración, eliminación y sustitución usan textos y tonos específicos', async () => {
  const source = await readFile('script.js', 'utf8'); assert.match(source, /title:'Mover a la papelera'.*confirmLabel:'Mover a la papelera'.*pendingLabel:'Moviendo…'.*tone:'warning'/s); assert.match(source, /title:'Restaurar evaluación'.*confirmLabel:'Restaurar'/s); assert.match(source, /title:'Eliminar definitivamente'.*confirmLabel:'Eliminar definitivamente'.*tone:'danger'/s);
  const flow = source.slice(source.indexOf('async function applyPreviousSubarea'), source.indexOf('function undoPreviousSubarea')); assert.match(flow, /Sustituir puntuaciones/); assert.match(flow, /cancelLabel:'Cancelar'/);
});
test('el CSS adapta acciones en móvil, reserva danger y reduce movimiento', async () => {
  const css = await readFile('styles.css', 'utf8'); assert.match(css, /@media\(max-width:520px\)[^\n]*\.battelle-dialog__actions\{[^}]*flex-direction:column/s); assert.match(css, /\[data-tone=danger\]/); assert.match(css, /@media\(prefers-reduced-motion:reduce\)/); assert.match(css, /\.battelle-toasts/);
});
