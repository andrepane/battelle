import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson } from '../src/battelle-data.js';
import { lookupPercentile, percentileForScale, lookupEquivalentAge } from '../src/battelle-conversions.js';
const percentiles = await loadJson('data/percentiles_battelle.json');
const ages = await loadJson('data/edades_equivalentes.json');
for (const [age, pd, pct] of [[0,18,98],[6,22,92],[12,35,98],[18,36,93],[24,36,86]]) test(`percentil selecciona tramo ${age}`,()=>assert.equal(lookupPercentile({ageMonths:age,scaleName:'Interacción con el adulto',directScore:pd,percentileData:percentiles}).percentile,pct));
test('percentiles: límites, abierto, sin coincidencia, doble, escala inexistente, 36-47, null y revisión',()=>{
  assert.equal(lookupPercentile({ageMonths:0,scaleName:'Interacción con el adulto',directScore:18,percentileData:percentiles}).ok,true);
  assert.equal(lookupPercentile({ageMonths:0,scaleName:'Interacción con el adulto',directScore:36,percentileData:percentiles}).ok,true);
  assert.equal(lookupPercentile({ageMonths:0,scaleName:'Interacción con el adulto',directScore:99,percentileData:percentiles}).error.code,'sin_coincidencia');
  const dup=structuredClone(percentiles); dup.tramos[0].registros.push({...dup.tramos[0].registros[0]});
  assert.equal(lookupPercentile({ageMonths:0,scaleName:'Interacción con el adulto',directScore:18,percentileData:dup}).error.code,'coincidencia_multiple');
  assert.equal(lookupPercentile({ageMonths:0,scaleName:'No existe',directScore:1,percentileData:percentiles}).error.code,'escala_no_encontrada');
  assert.equal(lookupPercentile({ageMonths:36,scaleName:'Interacción con el adulto',directScore:1,percentileData:percentiles}).error.code,'tramo_no_disponible');
  assert.equal(lookupPercentile({ageMonths:0,scaleName:'Interacción con el adulto',directScore:null,percentileData:percentiles}).error.code,'pd_null');
  assert.equal(percentileForScale({ageMonths:0,scaleId:'personal_social_total',directScore:10,percentileData:percentiles,requiresReview:true}).error.code,'requiere_revision');
});
for (const [pd, m] of [[386,37],[421,41],[436,43],[464,47],[537,57],[562,60]]) test(`N-65 ${pd} -> ${m}`,()=>assert.equal(lookupEquivalentAge({scaleId:'battelle_total',directScore:pd,equivalentAgeData:ages}).minMonths,m));
test('edades equivalentes: intervalo, null, excluidas, sin y doble coincidencia',()=>{
  const top=lookupEquivalentAge({scaleId:'battelle_total',directScore:682,equivalentAgeData:ages}); assert.equal(top.minMonths,90); assert.equal(top.maxMonths,95);
  assert.equal(lookupEquivalentAge({scaleId:'battelle_total',directScore:null,equivalentAgeData:ages}).error.code,'pd_null');
  assert.equal(lookupEquivalentAge({scaleId:'screening_total',directScore:1,equivalentAgeData:ages}).error.code,'escala_no_permitida');
  assert.equal(lookupEquivalentAge({scaleId:'N-54 screening_areas',directScore:1,equivalentAgeData:ages}).error.code,'escala_no_permitida');
  assert.equal(lookupEquivalentAge({scaleId:'battelle_total',directScore:-1,equivalentAgeData:ages}).error.code,'sin_coincidencia');
  const dup=structuredClone(ages); dup.escalas['N-65 battelle_total'].registros.push({...dup.escalas['N-65 battelle_total'].registros[0]});
  assert.equal(lookupEquivalentAge({scaleId:'battelle_total',directScore:0,equivalentAgeData:dup}).error.code,'coincidencia_multiple');
});
