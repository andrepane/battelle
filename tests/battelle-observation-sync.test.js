import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessmentRecord, sanitizeRecord, saveAssessment, getAssessment } from '../src/battelle-assessment-repository.js';
import { toFirestorePayload, fromFirestoreDocument } from '../src/battelle-firestore-repository.js';
import { createSaveCoordinator } from '../src/battelle-save-coordinator.js';
import { loadScaleModel } from '../src/battelle-scales.js';

const record=()=>createAssessmentRecord({id:'bat-observation',name:'Test',birthDate:'2021-01-01',assessmentDate:'2026-01-01',ageMonths:60,therapistName:'Andrea Panepinto LG',observedResponses:{A1:2}});
test('all UI subarea observations and legacy item notes survive validation and Firestore serialization',async()=>{
  const model=await loadScaleModel();const assessment=record();
  assessment.observations=Object.fromEntries(Object.values(model.subareas).map(s=>[`subarea:${s.subarea}`,'Observación clínica: ñ, tildes y\nsegunda línea.']));
  assessment.observations['subarea:Comunicación expresiva']='Texto';assessment.observations.A1='Nota previa';
  assert.deepEqual(sanitizeRecord(assessment).observations,assessment.observations);
  const payload=toFirestorePayload(assessment,'user-test');assert.ok(payload);
  const reopened=fromFirestoreDocument(assessment.id,{...payload,revision:1,createdBy:'user-test',updatedBy:'user-test'});
  assert.deepEqual(reopened.observations,assessment.observations);
});
test('observation edit saves, reopens and permits subsequent score saves through the queue',async()=>{
 const values=new Map();const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 let assessment=record();const queue=createSaveCoordinator({assessmentId:assessment.id,saveSnapshot:(s,revision)=>saveAssessment(s,storage,{expectedRevision:revision}),applySaved:s=>{assessment=s;}});
 assessment.observations['subarea:Motora fina']='Primera observación';assert.equal((await queue.enqueue(assessment)).ok,true);
 assessment.observations['subarea:Motora fina']='Texto editado';assessment.observedResponses.A2=1;assert.equal((await queue.enqueue(assessment)).ok,true);
 const reopened=await getAssessment(assessment.id,storage);assert.equal(reopened.observations['subarea:Motora fina'],'Texto editado');assert.equal(reopened.observedResponses.A2,1);assert.equal(reopened.revision,2);
});
test('invalid observations and subarea keys in score maps remain rejected',()=>{
 for(const observations of [{'subarea:': 'x'},{'subarea:Test':2},{'subarea:Test\n':'x'},JSON.parse('{"__proto__":"x"}')])assert.equal(sanitizeRecord({...record(),observations}),null);
 assert.equal(sanitizeRecord({...record(),observedResponses:{'subarea:Motora fina':2}}),null);
});
