import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAndNormalizeItems } from '../src/battelle-data.js';
import { loadScaleModel, validateScaleModel } from '../src/battelle-scales.js';
import { scoreAssessment } from '../src/battelle-scoring.js';
import { runCorrection } from '../src/battelle-correction.js';
import { lookupEquivalentAge, lookupGeneralConversion, lookupPercentile, lookupTotalCentile } from '../src/battelle-conversions.js';
const j=async f=>JSON.parse(await readFile(f,'utf8'));
const normativeData=await (async()=>({percentiles:await j('data/percentiles_battelle.json'),total:await j('data/conversion_total_battelle.json'),pcGeneral:await j('data/conversion_pc_general.json'),equivalentAges:await j('data/edades_equivalentes.json'),metadata:await j('data/baremos_metadata.json'),incidences:await j('data/baremos_incidencias.json')}))();

function makeAssessment(items, score=1, ageMonths=37){ return {id:'real',schemaVersion:2,name:'Completa',birthDate:'2024-01-01',assessmentDate:'2024-02-01',ageMonths,manualAgeOverride:true,observedResponses:Object.fromEntries(items.map(item=>[item.codigo_canonico,score])),observations:{},createdAt:'',updatedAt:''}; }

test('integración real: corrección completa con los 341 ítems y baremos reales', async()=>{
  const [items, model] = await Promise.all([loadAndNormalizeItems(), loadScaleModel()]); validateScaleModel(model, items);
  let calls=0; const result=runCorrection({ assessment:makeAssessment(items,1,37), items, model, normativeData, scoreAssessment(...args){ calls++; return scoreAssessment(...args); } });
  assert.equal(calls,1); assert.equal(result.ok,true); assert.equal(result.status,'corregida'); assert.equal(Object.keys(result.results.subareas).length,22);
  assert.equal(result.results.scales.battelle_total.percentile.status,'no_aplicable');
  assert.equal(result.results.totalCentile.ok,true); assert.equal(result.results.generalConversion.ok,true); assert.equal(result.results.summary.totalEquivalentAge.ok,true);
  for (const id of ['personal_social_total','adaptativa_total','motora_total','comunicacion_total','cognitiva_total']) assert.equal(result.results.scales[id].percentile.ok,true);
  assert(Object.values(result.results.subareas).some(s=>s.percentile?.ok));
  assert(result.results.totalCentile.source?.archivo); assert(result.results.generalConversion.source?.archivo); assert(result.results.normative.id.startsWith('norm-'));
});

test('end-to-end esperado desde filas reales independientes del algoritmo', async()=>{
  const [items, model] = await Promise.all([loadAndNormalizeItems(), loadScaleModel()]);
  const scoring=scoreAssessment(items, model, makeAssessment(items,1,37).observedResponses);
  const totalPd=scoring.escalas.battelle_total.pd;
  const expectedN2=normativeData.total.registros.find(r=>r.tramo_cronologico==='36-47' && r.pd_min<=totalPd && totalPd<=(r.pd_max??(r.limite_superior_abierto?Infinity:r.pd_min)));
  const expectedN1=normativeData.pcGeneral.registros.find(r=>r.pc===expectedN2.centil);
  const expectedN65=normativeData.equivalentAges.registros.find(r=>r.escala_id==='battelle_total' && r.pd_min<=totalPd && totalPd<=(r.pd_max??(r.limite_superior_abierto?Infinity:r.pd_min)));
  assert.equal(lookupTotalCentile({ageMonths:37,directScore:totalPd,normativeData}).centile, expectedN2.centil);
  assert.equal(lookupGeneralConversion({pc:expectedN2.centil,normativeData}).CI, expectedN1.CI);
  assert.equal(lookupEquivalentAge({scaleId:'battelle_total',directScore:totalPd,normativeData}).text, expectedN65.edad_equivalente_texto);
  const ps=scoring.escalas.personal_social_total.pd; const expectedPct=normativeData.percentiles.registros.find(r=>r.tramo_cronologico==='36-47' && r.escala_id==='personal_social_total' && r.pd_min<=ps && ps<=(r.pd_max??(r.limite_superior_abierto?Infinity:r.pd_min)));
  assert.equal(lookupPercentile({ageMonths:37,scaleId:'personal_social_total',directScore:ps,normativeData}).percentile, expectedPct.percentil);
});
