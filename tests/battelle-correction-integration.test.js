import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndNormalizeItems } from '../src/battelle-data.js';
import { loadScaleModel, validateScaleModel } from '../src/battelle-scales.js';
import { scoreAssessment } from '../src/battelle-scoring.js';
import { runCorrection } from '../src/battelle-correction.js';

test('integración real: corrección completa determinista con todos los ítems en 2', async()=>{
  const [items, model] = await Promise.all([loadAndNormalizeItems(), loadScaleModel()]);
  validateScaleModel(model, items);
  const observedResponses=Object.fromEntries(items.map(item=>[item.codigo_canonico, 2]));
  let calls=0;
  const result=runCorrection({ assessment:{id:'real',schemaVersion:2,name:'Completa',birthDate:'2024-01-01',assessmentDate:'2024-02-01',ageMonths:null,manualAgeOverride:false,observedResponses,observations:{},createdAt:'',updatedAt:''}, items, model, scoreAssessment(...args){ calls++; return scoreAssessment(...args); } });
  assert.equal(calls,1);
  assert.equal(result.ok,true);
  assert.equal(result.status,'corregida');
  assert.equal(result.results.scales.battelle_total.pd,682);
  assert.equal(Object.keys(result.results.subareas).length,22);
  assert.equal(result.results.scales.personal_social_total.maximo,170);
  assert.equal(result.results.scales.adaptativa_total.maximo,118);
  assert.equal(result.results.scales.motora_total.maximo,164);
  assert.equal(result.results.scales.comunicacion_total.maximo,118);
  assert.equal(result.results.scales.cognitiva_total.maximo,112);
  assert.equal(result.results.scales.battelle_total.maximo,682);
  assert.equal(result.results.scales.battelle_total.percentile.status,'no_aplicable');
  for (const scale of Object.values(result.results.scales)) {
    assert.notEqual(scale.percentile?.status, 'valido');
    assert.equal(scale.equivalentAge?.ok, false);
    assert.equal(scale.equivalentAge?.error?.code, 'escala_no_incluida');
  }
  const subCounts=Object.values(result.results.subareas).map(s=>s.counts);
  assert(subCounts.every(c=>Number.isInteger(c.observed) && Number.isInteger(c.derivedByBasal) && Number.isInteger(c.derivedByCeiling) && c.directScore !== undefined));
});
