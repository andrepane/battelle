import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessment } from '../src/battelle-state.js';
import { COLLECTION_ERROR, createAssessmentRecord, getAssessment, saveAssessment } from '../src/battelle-assessment-repository.js';
import { createCorrectionFingerprint } from '../src/battelle-correction.js';
import { SCORING_RULES_VERSION } from '../src/battelle-scoring.js';

function memoryStorage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}

test('documentos anteriores conservan legacy o manual-v2 y las evaluaciones nuevas usan manual-v3',()=>{
  const old=createAssessmentRecord({id:'bat-old'});
  const v2=createAssessmentRecord({...createAssessment(new Date('2026-09-24T09:00:00Z')),id:'bat-v2',scoringRulesVersion:SCORING_RULES_VERSION.MANUAL_V2});
  const fresh=createAssessmentRecord(createAssessment(new Date('2026-09-24T10:00:00Z')));
  assert.equal(old.scoringRulesVersion,SCORING_RULES_VERSION.LEGACY);
  assert.equal(v2.scoringRulesVersion,SCORING_RULES_VERSION.MANUAL_V2);
  assert.equal(fresh.scoringRulesVersion,SCORING_RULES_VERSION.CURRENT);
});

test('guardar o abrir una evaluación antigua no cambia su motor y no permite sustituirlo',async()=>{
  const storage=memoryStorage();
  let old=await saveAssessment(createAssessmentRecord({id:'bat-old'}),storage,{now:()=> '2026-01-01T00:00:00.000Z'});
  const snapshot=structuredClone(old);
  old=await getAssessment(old.id,storage);
  assert.deepEqual(old,snapshot);
  await assert.rejects(saveAssessment({...old,scoringRulesVersion:SCORING_RULES_VERSION.CURRENT},storage),error=>error.code===COLLECTION_ERROR.RULES_VERSION);
  assert.deepEqual(await getAssessment(old.id,storage),snapshot);
});

test('una evaluación manual-v2 se guarda y reabre sin convertirse en manual-v3',async()=>{
  const storage=memoryStorage();
  const record=createAssessmentRecord({...createAssessment(new Date('2026-09-24T10:00:00Z')),id:'bat-v2-stable',scoringRulesVersion:SCORING_RULES_VERSION.MANUAL_V2});
  const saved=await saveAssessment(record,storage,{now:()=> '2026-09-24T10:01:00.000Z'});
  assert.equal(saved.scoringRulesVersion,SCORING_RULES_VERSION.MANUAL_V2);
  const reopened=await getAssessment(saved.id,storage);
  assert.equal(reopened.scoringRulesVersion,SCORING_RULES_VERSION.MANUAL_V2);
  await assert.rejects(saveAssessment({...reopened,scoringRulesVersion:SCORING_RULES_VERSION.CURRENT},storage),error=>error.code===COLLECTION_ERROR.RULES_VERSION);
});

test('huellas antiguas conservan el formato histórico y las nuevas incluyen el motor',()=>{
  const base={birthDate:'2020-01-01',assessmentDate:'2024-01-01',manualAgeOverride:false,observedResponses:{A1:2}};
  assert.equal(createCorrectionFingerprint({assessment:base}),createCorrectionFingerprint({assessment:{...base,scoringRulesVersion:SCORING_RULES_VERSION.LEGACY}}));
  const v2=createCorrectionFingerprint({assessment:{...base,scoringRulesVersion:SCORING_RULES_VERSION.MANUAL_V2}});
  const v3=createCorrectionFingerprint({assessment:{...base,scoringRulesVersion:SCORING_RULES_VERSION.CURRENT}});
  assert.notEqual(createCorrectionFingerprint({assessment:base}),v2);
  assert.notEqual(v2,v3);
});
