import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('el pulido final conserva una jerarquía coherente y adaptación móvil',async()=>{
  const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
  for(const selector of ['.saved-header','.patient-card h2','.age-apply','.layout>.area-nav','.subarea-card>summary.subarea-summary:hover']) assert.ok(css.includes(selector));
  assert.match(css,/\.saved-header \.results-actions\{display:grid;grid-template-columns:1fr 1fr\}/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
