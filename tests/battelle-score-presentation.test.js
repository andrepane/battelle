import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndNormalizeItems } from '../src/battelle-data.js';
import { loadScaleModel } from '../src/battelle-scales.js';
import { scoreAssessment } from '../src/battelle-scoring.js';
import { scorePresentation, scoreButtonAccessibility } from '../src/battelle-score-presentation.js';
import { createAssessment, parseStoredAssessment, serializeAssessment } from '../src/battelle-state.js';

const items=await loadAndNormalizeItems();
const model=await loadScaleModel();
const derive=(observed)=>scoreAssessment(items,model,observed);
const basalSupport={PS6:2,PS7:2,PS8:2};
const ceilingSupport={PS1:2,PS2:2,PS3:2,PS4:2,PS5:2,PS8:0,PS9:0};

function selected(response){ return [null,0,1,2].filter(score=>scoreButtonAccessibility('PS',score,response).pressed); }

test('un ítem inferior al basal selecciona 2 BASAL, nunca guion, sin persistirlo como observado',()=>{
  const scoring=derive(basalSupport); const response=scoring.respuestas_efectivas.PS1;
  assert.deepEqual(scorePresentation(response),{origin:'basal',score:2,label:'2 BASAL'});
  assert.deepEqual(selected(response),[2]);
  assert.equal(Object.hasOwn(scoring.respuestas_observadas,'PS1'),false);
  assert.match(scoreButtonAccessibility('PS1',2,response).ariaLabel,/2 derivado por basal/);
});

test('un ítem posterior al techo selecciona 0 TECHO, nunca guion, sin persistirlo como observado',()=>{
  const scoring=derive(ceilingSupport); const response=scoring.respuestas_efectivas.PS10;
  assert.deepEqual(scorePresentation(response),{origin:'techo',score:0,label:'0 TECHO'});
  assert.deepEqual(selected(response),[0]);
  assert.equal(Object.hasOwn(scoring.respuestas_observadas,'PS10'),false);
  assert.match(scoreButtonAccessibility('PS10',0,response).ariaLabel,/0 derivado por techo/);
});

test('editar un derivado lo convierte en observado y eliminarlo recupera la derivación',()=>{
  const observed={...basalSupport};
  let response=derive(observed).respuestas_efectivas.PS1;
  assert.equal(scorePresentation(response).origin,'basal');
  observed.PS1=1;
  response=derive(observed).respuestas_efectivas.PS1;
  assert.deepEqual(scorePresentation(response),{origin:'observado',score:1,label:'1 OBS.'});
  assert.match(scoreButtonAccessibility('PS1',1,response).ariaLabel,/respuesta observada/);
  delete observed.PS1;
  response=derive(observed).respuestas_efectivas.PS1;
  assert.deepEqual(scorePresentation(response),{origin:'basal',score:2,label:'2 BASAL'});
});

test('cambiar sustentos elimina inmediatamente las selecciones derivadas obsoletas',()=>{
  let response=derive(basalSupport).respuestas_efectivas.PS1;
  assert.deepEqual(selected(response),[2]);
  response=derive({...basalSupport,PS8:1}).respuestas_efectivas.PS1;
  assert.deepEqual(selected(response),[null]);
  response=derive(ceilingSupport).respuestas_efectivas.PS10;
  assert.deepEqual(selected(response),[0]);
  response=derive({...ceilingSupport,PS9:1}).respuestas_efectivas.PS10;
  assert.deepEqual(selected(response),[null]);
});

test('guardar y reabrir conserva observadas y reconstruye derivadas solo mediante el motor',()=>{
  const assessment=createAssessment(new Date('2026-07-27T00:00:00Z'));
  Object.assign(assessment,{name:'Regresión',birthDate:'2024-01-01',assessmentDate:'2026-07-27',observedResponses:{...basalSupport}});
  const reopened=parseStoredAssessment(serializeAssessment(assessment));
  assert.equal(reopened.ok,true);
  assert.deepEqual(reopened.assessment.observedResponses,basalSupport);
  assert.equal(Object.hasOwn(reopened.assessment.observedResponses,'PS1'),false);
  assert.equal(derive(reopened.assessment.observedResponses).respuestas_efectivas.PS1.origen,'basal');
});
