import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndNormalizeItems } from '../src/battelle-data.js';
import { loadScaleModel } from '../src/battelle-scales.js';
import { validateResponse, scoreAssessment } from '../src/battelle-scoring.js';
const items = await loadAndNormalizeItems(); const model = await loadScaleModel();
const sub = (area, subarea)=>items.filter(i=>i.area===area&&i.subarea===subarea);

test('respuestas: null no suma, acepta 0/1/2, rechaza otros y no muta', () => {
  [0,1,2].forEach(v=>assert.equal(validateResponse(v), v)); assert.throws(()=>validateResponse(3));
  const original = {'PS 1': 1}; const copy=structuredClone(original); const r=scoreAssessment(items, model, original);
  assert.deepEqual(original, copy); assert.equal(r.respuestas_efectivas.PS2.puntuacion, null);
  assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].pd, null); assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].pd_parcial, 1);
});

test('basal: dos 2 consecutivos mismo nivel derivan anteriores; separados/niveles/subáreas no', () => {
  let r=scoreAssessment(items, model, {'PS 6':2,'PS 7':2});
  assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].basal.confirmado, true); assert.equal(r.respuestas_efectivas.PS1.origen, 'basal'); assert.equal(r.respuestas_efectivas.PS1.puntuacion, 2);
  r=scoreAssessment(items, model, {'PS 6':2,'PS 8':2}); assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].basal.confirmado, false);
  r=scoreAssessment(items, model, {'PS 8':2,'PS 9':2}); assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].basal.confirmado, false);
  r=scoreAssessment(items, model, {'PS 18':2,'PS 19':2}); assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].basal.confirmado, false);
  r=scoreAssessment(items, model, {'PS 1':1,'PS 6':2,'PS 7':2}); assert.equal(r.respuestas_efectivas.PS1.puntuacion, 1); assert.equal(r.advertencias.some(w=>w.tipo==='inconsistencia_basal'), true);
});

test('techo: dos 0 consecutivos mismo nivel derivan posteriores; separados/niveles no', () => {
  let r=scoreAssessment(items, model, {'PS 1':2,'PS 2':2,'PS 6':0,'PS 7':0});
  assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].techo.confirmado, true); assert.equal(r.respuestas_efectivas.PS8.origen, 'techo'); assert.equal(r.respuestas_efectivas.PS8.puntuacion, 0);
  r=scoreAssessment(items, model, {'PS 1':2,'PS 2':2,'PS 6':0,'PS 8':0}); assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].techo.confirmado, false);
  r=scoreAssessment(items, model, {'PS 1':2,'PS 2':2,'PS 8':0,'PS 9':0}); assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].techo.confirmado, false);
  r=scoreAssessment(items, model, {'PS 1':2,'PS 2':2,'PS 6':0,'PS 7':0,'PS 9':1}); assert.equal(r.respuestas_efectivas.PS9.puntuacion, 1); assert.equal(r.advertencias.some(w=>w.tipo==='inconsistencia_techo'), true);
});

test('completitud: huecos internos invalidan PD y evaluación; cobertura completa valida', () => {
  let r=scoreAssessment(items, model, {'PS 1':2,'PS 2':2,'PS 6':0,'PS 7':0});
  assert.equal(r.subareas['Personal/Social|Interacción con el adulto'].pd, null); assert.equal(typeof r.subareas['Personal/Social|Interacción con el adulto'].pd_parcial, 'number'); assert.equal(r.escalas.personal_social_total.pd, null); assert.equal(r.escalas.battelle_total.pd, null);
  const all2=Object.fromEntries(items.map(i=>[i.codigo_canonico,2])); r=scoreAssessment(items, model, all2);
  assert.equal(r.evaluacion_completa, true); assert.equal(r.escalas.battelle_total.pd, 682);
});

test('agregados sintéticos completos y sin doble conteo', () => {
  const responses=Object.fromEntries(items.map(i=>[i.codigo_canonico, i.area==='Motora'?1:2])); const r=scoreAssessment(items, model, responses);
  assert.equal(r.subareas['Motora|Control muscular'].pd, sub('Motora','Control muscular').length);
  assert.equal(r.escalas.personal_social_total.pd, 170); assert.equal(r.escalas.adaptativa_total.pd, 118);
  assert.equal(r.escalas.motora_gruesa.pd, 44); assert.equal(r.escalas.motora_fina.pd, 38); assert.equal(r.escalas.motora_total.pd, 82);
  assert.equal(r.escalas.comunicacion_total.pd, 118); assert.equal(r.escalas.cognitiva_total.pd, 112); assert.equal(r.escalas.battelle_total.pd, 600);
});
