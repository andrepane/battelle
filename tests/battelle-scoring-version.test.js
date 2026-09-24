import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessment } from '../src/battelle-state.js';
import { COLLECTION_ERROR, createAssessmentRecord, getAssessment, saveAssessment } from '../src/battelle-assessment-repository.js';
import { createCorrectionFingerprint } from '../src/battelle-correction.js';
import { SCORING_RULES_VERSION } from '../src/battelle-scoring.js';

function memoryStorage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};}

test('documentos anteriores sin versión quedan en legacy y las evaluaciones nuevas usan manual-v2',()=>{
  const old=createAssessmentRecord({id:'bat-old'});
  const fresh=createAssessmentRecord(createAssessment(new Date('2026-09-24T10:00:00Z')));
  assert.equal(old.scoringRulesVersion,SCORING_RULES_VERSION.LEGACY);
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

test('huellas antiguas conservan el formato histórico y las nuevas incluyen el motor',()=>{
  const base={birthDate:'2020-01-01',assessmentDate:'2024-01-01',manualAgeOverride:false,observedResponses:{A1:2}};
  assert.equal(createCorrectionFingerprint({assessment:base}),createCorrectionFingerprint({assessment:{...base,scoringRulesVersion:SCORING_RULES_VERSION.LEGACY}}));
  assert.notEqual(createCorrectionFingerprint({assessment:base}),createCorrectionFingerprint({assessment:{...base,scoringRulesVersion:SCORING_RULES_VERSION.CURRENT}}));
});
