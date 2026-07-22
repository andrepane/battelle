import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndNormalizeItems, normalizeItemCode, parseAgeRange } from '../src/battelle-data.js';
import { loadScaleModel, validateScaleModel, calculateScaleMaximum } from '../src/battelle-scales.js';

const items = await loadAndNormalizeItems();
const model = await loadScaleModel();

test('normaliza 341 ítems, recuentos, códigos únicos y rangos', () => {
  assert.equal(items.length, 341);
  assert.deepEqual(Object.fromEntries(['Personal/Social','Adaptativa','Motora','Comunicación','Cognitiva'].map(a=>[a, items.filter(i=>i.area===a).length])), {'Personal/Social':85, Adaptativa:59, Motora:82, 'Comunicación':59, Cognitiva:56});
  assert.equal(new Set(items.map(i=>i.codigo_canonico)).size, 341);
  assert.deepEqual(parseAgeRange('12-23'), {min:12,max:23,etiqueta:'12-23'});
  assert.equal(normalizeItemCode('PS 1'), 'PS1');
  assert.equal(normalizeItemCode('PS1'), 'PS1');
});

test('modelo de escalas cubre ítems, subáreas existentes y máximos teóricos', () => {
  assert.doesNotThrow(()=>validateScaleModel(model, items));
  const maxima = Object.fromEntries(Object.entries(model.escalas).map(([id,s])=>[id, calculateScaleMaximum(s, items)]));
  assert.deepEqual(maxima, { personal_social_total:170, adaptativa_total:118, motora_gruesa:88, motora_fina:76, motora_total:164, comunicacion_receptiva:54, comunicacion_expresiva:64, comunicacion_total:118, cognitiva_total:112, battelle_total:682 });
});
