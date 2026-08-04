import test from 'node:test';
import assert from 'node:assert/strict';
import { executableSource, nativeDialogCalls } from '../scripts/check-native-dialogs.js';

test('la auditoría detecta llamadas reales y variantes de window', () => {
  const source = `alert('a'); window.confirm('b');\nwindow . prompt ('c');`;
  assert.deepEqual(nativeDialogCalls(source).map(item => item.name), ['alert', 'confirm', 'prompt']);
});
test('la auditoría ignora documentación, comentarios y nombres no invocados', () => {
  const source = `// alert('comentario')\nconst guide = "window.confirm('texto')";\nfunction confirmation() {}\nobj.promptValue = true;`;
  assert.deepEqual(nativeDialogCalls(source), []); assert.equal(executableSource(source).split('\n').length, source.split('\n').length);
});
