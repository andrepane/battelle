import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('los cuatro campos conservan el orden de lectura, atributos y datalist', async () => {
  const html = await read('index.html');
  const form = html.match(/<div class="form-grid">([\s\S]*?)<\/div><details class="age-override">/)?.[1];
  assert.ok(form, 'debe existir la rejilla seguida por la zona de edad');

  const ids = [...form.matchAll(/<input id="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(ids, ['patientName', 'therapistName', 'birthDate', 'assessmentDate']);
  assert.match(form, /id="therapistName"[^>]*list="therapistSuggestions"[^>]*required/);
  assert.match(form, /<datalist id="therapistSuggestions"><\/datalist>/);
  assert.match(form, /id="birthDate" type="date"/);
  assert.match(form, /id="assessmentDate" type="date"/);
});

test('la rejilla responde con cuatro, dos y una columnas sin alterar los controles', async () => {
  const css = await read('styles.css');
  assert.match(css, /\.patient-card \.form-grid\{\s*grid-template-columns:minmax\(0,1\.3fr\) minmax\(0,1\.3fr\) minmax\(180px,1fr\) minmax\(180px,1fr\);/);
  assert.match(css, /@media\(max-width:1050px\)\{\s*\.patient-card \.form-grid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css, /@media\(max-width:520px\)\{\s*\.patient-card \.form-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css, /\.patient-card \.form-grid input:not\(\[type=checkbox\]\)\{min-width:0;height:var\(--control-height\)\}/);
});

test('la edad es una zona inferior de ancho completo con controles colapsados', async () => {
  const [html, css] = await Promise.all([read('index.html'), read('styles.css')]);
  assert.match(html, /<\/div><details class="age-override"><summary>/);
  assert.match(html, /<details class="age-override"><summary>[\s\S]*?<\/summary><div class="age-controls">/);
  assert.match(css, /\.age-override\{width:100%\}/);
  assert.match(css, /\.age-override>summary\{display:flex;align-items:center;justify-content:space-between;/);
});
