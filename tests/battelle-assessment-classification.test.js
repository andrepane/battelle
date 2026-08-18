import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSESSMENT_CATEGORY, WORKFLOW_STATUS, classifyAssessment, createAssessmentRecord, filterAssessments } from '../src/battelle-assessment-repository.js';

const assessment=(id,workflowStatus,extra={})=>({id,workflowStatus,observedResponses:{},correctionMetadata:{},...extra});

test('la clasificación central distingue todos los estados del listado',()=>{
  const cases=[
    [assessment('draft',WORKFLOW_STATUS.DRAFT),ASSESSMENT_CATEGORY.DRAFT,'Borrador'],
    [assessment('pending',WORKFLOW_STATUS.PENDING,{observedResponses:{A1:1}}),ASSESSMENT_CATEGORY.PENDING,'Pendiente'],
    [assessment('corrected',WORKFLOW_STATUS.CORRECTED,{correctionMetadata:{fingerprint:'current'}}),ASSESSMENT_CATEGORY.CORRECTED,'Corregida'],
    [assessment('blocked',WORKFLOW_STATUS.BLOCKED,{correctionMetadata:{blockedAt:'2026-01-01T00:00:00Z'}}),ASSESSMENT_CATEGORY.ATTENTION,'Requiere atención'],
    [assessment('stale',WORKFLOW_STATUS.STALE,{correctionMetadata:{fingerprint:'old'}}),ASSESSMENT_CATEGORY.ATTENTION,'Requiere atención']
  ];
  for(const [record,category,label] of cases) assert.deepEqual({category:classifyAssessment(record).category,label:classifyAssessment(record).label},{category,label});
});

test('cada filtro contiene exclusivamente su categoría y Todas conserva el listado completo',()=>{
  const records=[
    assessment('draft',WORKFLOW_STATUS.DRAFT),
    assessment('pending',WORKFLOW_STATUS.PENDING,{observedResponses:{A1:1}}),
    assessment('corrected',WORKFLOW_STATUS.CORRECTED),
    assessment('blocked',WORKFLOW_STATUS.BLOCKED),
    assessment('stale',WORKFLOW_STATUS.STALE)
  ];
  assert.deepEqual(filterAssessments(records,{filter:'all'}).map(r=>r.id),['draft','pending','corrected','blocked','stale']);
  assert.deepEqual(filterAssessments(records,{filter:'drafts'}).map(r=>r.id),['draft']);
  assert.deepEqual(filterAssessments(records,{filter:'pending'}).map(r=>r.id),['pending']);
  assert.deepEqual(filterAssessments(records,{filter:'corrected'}).map(r=>r.id),['corrected']);
  assert.deepEqual(filterAssessments(records,{filter:'attention'}).map(r=>r.id),['blocked','stale']);
  assert.equal(filterAssessments(records,{filter:'attention'}).some(r=>r.id==='pending'),false);
});

test('registros antiguos o incompletos se recuperan sin modificar datos clínicos',()=>{
  const legacyPending=assessment('legacy-pending','administrando',{observedResponses:{A1:2},observations:{A1:'con ayuda'}});
  const incompleteStatus=assessment('missing-status',undefined,{observedResponses:{A2:0}});
  const legacyBlocked=assessment('legacy-blocked','conflicto');
  const legacyResultWithoutStatus=assessment('legacy-result',undefined,{correctionMetadata:{fingerprint:'old'}});
  const before=structuredClone([legacyPending,incompleteStatus,legacyBlocked,legacyResultWithoutStatus]);
  assert.equal(classifyAssessment(legacyPending).category,ASSESSMENT_CATEGORY.PENDING);
  assert.equal(classifyAssessment(incompleteStatus).category,ASSESSMENT_CATEGORY.PENDING);
  assert.equal(classifyAssessment(legacyBlocked).category,ASSESSMENT_CATEGORY.ATTENTION);
  assert.equal(classifyAssessment(legacyResultWithoutStatus).category,ASSESSMENT_CATEGORY.ATTENTION);
  assert.deepEqual([legacyPending,incompleteStatus,legacyBlocked,legacyResultWithoutStatus],before);
});

test('normalizar un borrador antiguo iniciado conserva respuestas, observaciones y puntuaciones',()=>{
  const source={id:'bat-old',workflowStatus:'borrador',observedResponses:{A1:2,A2:0},observations:{A1:'nota'}};
  const record=createAssessmentRecord(source);
  assert.equal(record.workflowStatus,WORKFLOW_STATUS.PENDING);
  assert.deepEqual(record.observedResponses,source.observedResponses);
  assert.deepEqual(record.observations,source.observations);
});

