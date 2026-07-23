import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupPercentile, percentileForScale, lookupEquivalentAge, validatePercentileMappings, NORMATIVE_PENDING_MESSAGE } from '../src/battelle-conversions.js';

test('conversiones normativas quedan pendientes sin inventar valores',()=>{
  const pct=lookupPercentile({ageMonths:12,scaleName:'Interacción con el adulto',directScore:10});
  assert.equal(pct.ok,false); assert.equal(pct.error.code,'baremos_pendientes'); assert.equal(pct.error.message,NORMATIVE_PENDING_MESSAGE); assert.equal(pct.percentile,undefined);
  const scale=percentileForScale({ageMonths:12,scaleId:'personal_social_total',directScore:20});
  assert.equal(scale.error.code,'baremos_pendientes');
  const age=lookupEquivalentAge({scaleId:'battelle_total',directScore:300});
  assert.equal(age.error.code,'baremos_pendientes'); assert.equal(age.minMonths,undefined); assert.equal(age.maxMonths,undefined);
});

test('PD inválida se rechaza antes del estado pendiente',()=>{
  for(const value of ['18',18.5,Number.NaN,Infinity,-1]){
    assert.equal(lookupPercentile({ageMonths:0,scaleName:'x',directScore:value}).error.code,'pd_invalida');
    assert.equal(lookupEquivalentAge({scaleId:'battelle_total',directScore:value}).error.code,'pd_invalida');
  }
});

test('no quedan cargas de JSON eliminados ni baremos incrustados', async()=>{
  for (const file of ['script.js','src/battelle-correction.js','src/battelle-conversions.js']) {
    const s=await readFile(file,'utf8');
    assert.equal(s.includes('data/' + 'percentiles_battelle.json'),false);
    assert.equal(s.includes('data/' + 'edades_equivalentes.json'),false);
  }
  assert.deepEqual(validatePercentileMappings().status,'baremos_pendientes');
});
