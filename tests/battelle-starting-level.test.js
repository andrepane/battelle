import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { itemIsInStartingLevel, startingLevelForAge, startingLevelSummary } from '../src/battelle-starting-level.js';
import { loadAndNormalizeItems } from '../src/battelle-data.js';
import { loadScaleModel } from '../src/battelle-scales.js';
import { scoreAssessment } from '../src/battelle-scoring.js';
import { createAssessment, parseStoredAssessment, serializeAssessment } from '../src/battelle-state.js';

const levels = [
  { codigo_canonico:'A1', rango_edad_min_meses:0, rango_edad_max_meses:5 },
  { codigo_canonico:'A2', rango_edad_min_meses:6, rango_edad_max_meses:11 },
  { codigo_canonico:'A3', rango_edad_min_meses:6, rango_edad_max_meses:11 },
  { codigo_canonico:'A4', rango_edad_min_meses:12, rango_edad_max_meses:17 },
];

test('selecciona el nivel completo para una edad intermedia y conserva el orden',()=>{
  const selected=startingLevelForAge(levels,8);
  assert.deepEqual(selected,{min:6,max:11,key:'6:11'});
  assert.deepEqual(levels.filter((item)=>itemIsInStartingLevel(item,selected)).map((item)=>item.codigo_canonico),['A2','A3']);
});

test('los límites mínimo y máximo son inclusivos',()=>{
  assert.equal(startingLevelForAge(levels,6).key,'6:11');
  assert.equal(startingLevelForAge(levels,11).key,'6:11');
});

test('un nivel de un solo ítem se selecciona normalmente',()=>{
  const selected=startingLevelForAge(levels,14);
  assert.deepEqual(levels.filter((item)=>itemIsInStartingLevel(item,selected)).map((item)=>item.codigo_canonico),['A4']);
});

test('el cálculo es independiente para subáreas con niveles diferentes',()=>{
  const other=[{rango_edad_min_meses:0,rango_edad_max_meses:8},{rango_edad_min_meses:9,rango_edad_max_meses:20}];
  assert.equal(startingLevelForAge(levels,8).key,'6:11');
  assert.equal(startingLevelForAge(other,8).key,'0:8');
});

test('una edad inferior usa el primer nivel',()=>assert.equal(startingLevelForAge([{...levels[1],rango_edad_min_meses:6,rango_edad_max_meses:11},levels[3]],2).key,'6:11'));
test('una edad superior usa el último nivel',()=>assert.equal(startingLevelForAge(levels,90).key,'12:17'));
test('una edad inválida no produce resaltado y muestra la indicación necesaria',()=>{
  for(const age of [null,undefined,NaN,4.5,-1]) assert.equal(startingLevelForAge(levels,age),null);
  assert.equal(startingLevelSummary(null),'Edad necesaria para calcular el inicio');
});

test('el contrato UI actualiza al cambiar edad y solo desplaza al cambiar edad o abrir',async()=>{
  const source=await readFile('script.js','utf8');
  assert.match(source,/updateStartingLevelVisuals\(\{scroll:true, reason:'age'\}\)/);
  assert.match(source,/reason:'open'/);
  const scoringHandler=source.slice(source.indexOf('function setObservedScore'),source.indexOf('function updateVisibleItemsEffective'));
  assert.doesNotMatch(scoringHandler,/scrollIntoView|updateStartingLevelVisuals/);
});

test('cambiar la edad no modifica observedResponses ni el motor clínico',async()=>{
  const items=await loadAndNormalizeItems();
  const model=await loadScaleModel();
  const observedResponses={PS1:2,PS2:1};
  const before=scoreAssessment(items,model,observedResponses);
  const snapshot=structuredClone(observedResponses);
  startingLevelForAge(items.filter((item)=>item.subarea==='Interacción con el adulto'),40);
  const after=scoreAssessment(items,model,observedResponses);
  assert.deepEqual(observedResponses,snapshot);
  assert.deepEqual(after,before);
});

test('el punto visual no cambia respuestas efectivas, basal, techo ni PD',async()=>{
  const items=await loadAndNormalizeItems(); const model=await loadScaleModel();
  const observed={PS1:2,PS2:2,PS3:2};
  const before=scoreAssessment(items,model,observed);
  for(const age of [0,12,95]) for(const subarea of new Set(items.map((item)=>item.subarea))) startingLevelForAge(items.filter((item)=>item.subarea===subarea),age);
  const after=scoreAssessment(items,model,observed);
  assert.deepEqual(after.respuestas_efectivas,before.respuestas_efectivas);
  assert.deepEqual(after.subareas,before.subareas);
  assert.deepEqual(after.escalas,before.escalas);
});

test('guardar y reabrir reconstruye el mismo nivel desde la edad guardada',()=>{
  const assessment=createAssessment(new Date('2026-07-27T00:00:00Z'));
  Object.assign(assessment,{name:'Caso',birthDate:'2024-01-01',assessmentDate:'2026-07-27',manualAgeOverride:true,ageMonths:8});
  const reopened=parseStoredAssessment(serializeAssessment(assessment));
  assert.equal(reopened.ok,true);
  assert.deepEqual(startingLevelForAge(levels,reopened.assessment.ageMonths),startingLevelForAge(levels,assessment.ageMonths));
});

test('la UI conserva los textos clínicos y los atributos accesibles requeridos',async()=>{
  const [source,styles]=await Promise.all([readFile('script.js','utf8'),readFile('styles.css','utf8')]);
  for(const text of ['Derivados por basal','Derivados por techo','Observados','PUNTO DE PARTIDA','Comenzar en el nivel']) assert.equal(source.includes(text),true);
  for(const token of ['startingLevel','startingItem','ariaPressed']) assert.equal(source.includes(token),true);
  assert.match(styles,/starting-item/);
});
