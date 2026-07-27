import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderHomeSource = async () => {
  const script = await readFile('script.js', 'utf8');
  const start = script.indexOf('async function renderHome(');
  const end = script.indexOf('\nasync function removeAssessment', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return script.slice(start, end);
};

test('renderHome construye por separado las listas normal y de papelera', async () => {
  const source = await renderHomeSource();

  assert.match(source, /if\(state\.trashMode\)\{\s*rows=filtered\.map/);
  assert.match(source, /restore-assessment/);
  assert.match(source, /purge-assessment/);
  assert.match(source, /\}else\{\s*rows=filtered\.map/);
  assert.match(source, /open-assessment/);
  assert.match(source, /delete-assessment/);
  assert.equal((source.match(/rows=filtered\.map/g) ?? []).length, 2);
});

test('renderHome conserva estados vacíos específicos para ambas listas', async () => {
  const source = await renderHomeSource();

  assert.match(source, /if\(!filtered\.length\)/);
  assert.match(source, /La papelera está vacía\./);
  assert.match(source, /No hay evaluaciones guardadas todavía\./);
});
