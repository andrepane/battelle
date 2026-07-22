import test from 'node:test';
import assert from 'node:assert/strict';
import { createCorrectionFingerprint, isCorrectionStale, runCorrection, buildDescriptiveSummary } from '../src/battelle-correction.js';
import { serializeAssessment, parseStoredAssessment } from '../src/battelle-state.js';

const items=[
  {codigo:'A1',codigo_canonico:'A1',area:'Personal/Social',subarea:'Interacción',rango_edad:'0-5',rango_edad_min_meses:0,rango_edad_max_meses:5,enunciado:'uno'},
  {codigo:'A2',codigo_canonico:'A2',area:'Personal/Social',subarea:'Interacción',rango_edad:'0-5',rango_edad_min_meses:0,rango_edad_max_meses:5,enunciado:'dos'},
  {codigo:'A3',codigo_canonico:'A3',area:'Personal/Social',subarea:'Interacción',rango_edad:'6-11',rango_edad_min_meses:6,rango_edad_max_meses:11,enunciado:'tres'},
  {codigo:'A4',codigo_canonico:'A4',area:'Personal/Social',subarea:'Interacción',rango_edad:'6-11',rango_edad_min_meses:6,rango_edad_max_meses:11,enunciado:'cuatro'},
];
const model={escalas:{personal_social_total:{nombre:'Personal/Social total'},battelle_total:{nombre:'Battelle total'}},subareas:{s1:{area:'Personal/Social',subarea:'Interacción'}}};
const assessment=(responses={})=>({id:'x',schemaVersion:2,name:'N',birthDate:'2024-01-01',assessmentDate:'2024-07-01',ageMonths:null,manualAgeOverride:false,observedResponses:responses,observations:{},createdAt:'',updatedAt:''});
const okScoring={errores:[],inconsistencias:[],respuestas_efectivas:{A1:{puntuacion:2,origen:'basal'},A2:{puntuacion:2,origen:'observado'},A3:{puntuacion:0,origen:'observado'},A4:{puntuacion:0,origen:'techo'}},subareas:{s1:{area:'Personal/Social',subarea:'Interacción',pd:4,pd_parcial:4,maximo:8,completa:true,requiere_revision:false,pendientes:[],inconsistencias:[],basal:{confirmado:true,inicio:'A1',fin:'A2'},techo:{confirmado:true,inicio:'A3',fin:'A4'},codigos:['A1','A2','A3','A4']}},escalas:{personal_social_total:{pd:4,pd_parcial:4,maximo:8,completa:true,requiere_revision:false,pendientes:[]},battelle_total:{pd:4,pd_parcial:4,maximo:8,completa:true,requiere_revision:false,pendientes:[]}}};

test('administración no calcula resultados y corregir ejecuta el motor una sola vez',()=>{ let calls=0; const r=runCorrection({assessment:assessment({A2:2,A3:0}),items,model,percentiles:{},equivalentAges:{},scoreAssessment(){calls++; return okScoring;}}); assert.equal(calls,1); assert.equal(r.ok,true); });

test('ítems derivados por basal y techo no quedan pendientes y una corrección completa produce PD',()=>{ const r=runCorrection({assessment:assessment({A2:2,A3:0}),items,model,percentiles:{},equivalentAges:{},scoreAssessment:()=>okScoring}); assert.equal(r.pendingReport.total,0); assert.equal(r.results.scales.personal_social_total.pd,4); assert.equal(r.results.summary.derivedByBasal,1); assert.equal(r.results.summary.derivedByCeiling,1); });

test('hueco interior, techo provisional y contradicciones bloquean con lista detallada',()=>{ const bad={...okScoring, inconsistencias:[{tipo:'inconsistencia_basal'}], subareas:{s1:{...okScoring.subareas.s1, pd:null, completa:false, requiere_revision:true, pendientes:['A3'], techo:{confirmado:true,provisional:true}}}, escalas:{personal_social_total:{pd:null,completa:false,pendientes:['A3']}}}; const r=runCorrection({assessment:assessment({A1:2}),items,model,percentiles:{},equivalentAges:{},scoreAssessment:()=>bad}); assert.equal(r.status,'correccion_bloqueada'); assert.equal(r.results,null); assert.equal(r.pendingReport.items[0].code,'A3'); assert.equal(r.pendingReport.items[0].area,'Personal/Social'); assert.equal(r.pendingReport.items[0].subarea,'Interacción'); assert.match(r.pendingReport.items[0].reason,/techo provisional|contradicción/); });

test('36-95 no falla por percentiles, Battelle total no inventa percentil y error del motor no genera resultados',()=>{ const a={...assessment({A1:2}), manualAgeOverride:true, ageMonths:52}; const r=runCorrection({assessment:a,items,model,percentiles:{},equivalentAges:{},scoreAssessment:()=>okScoring}); assert.equal(r.ok,true); assert.notEqual(r.results.scales.personal_social_total.percentile.status,'valido'); assert.equal(r.results.scales.battelle_total.percentile.status,'no_aplicable'); const e=runCorrection({assessment:a,items,model,percentiles:{},equivalentAges:{},scoreAssessment(){throw new Error('boom')}}); assert.equal(e.results,null); });

test('huella cambia con respuesta y edad, no con nombre ni observación; persistencia no guarda derivados',()=>{ const a=assessment({A1:2}); const fp=createCorrectionFingerprint({assessment:a}); a.name='Otro'; a.observations.A1='nota'; assert.equal(createCorrectionFingerprint({assessment:a}),fp); a.observedResponses.A1=1; assert.notEqual(createCorrectionFingerprint({assessment:a}),fp); const saved=parseStoredAssessment(serializeAssessment(a)); assert.equal(saved.ok,true); assert.equal(saved.assessment.results,undefined); assert.equal(saved.assessment.fingerprint,undefined); });

test('síntesis sin diagnósticos y con diferencia de intervalo',()=>{ const summary=buildDescriptiveSummary({results:{summary:{ageMonths:52,ageBand:'36-47'},scales:{c:{name:'Comunicación total',equivalentAgeLabel:'40–41 meses',equivalentAge:{ok:true,minMonths:40,maxMonths:41},percentile:{status:'no_normalizado'}}}}}); assert(summary.some(s=>s.includes('11–12 meses por debajo'))); assert(!summary.join(' ').match(/retraso|leve|moderado|grave|diagnóstico/i)); });

test('fecha de evaluación anterior al nacimiento bloquea aunque haya o no anulación manual y no ejecuta motor',()=>{
  for (const manualAgeOverride of [false,true]) {
    let calls=0;
    const a={...assessment({A1:2}), birthDate:'2024-07-01', assessmentDate:'2024-01-01', manualAgeOverride, ageMonths:6};
    const r=runCorrection({assessment:a,items,model,percentiles:{},equivalentAges:{},scoreAssessment(){calls++; return okScoring;}});
    assert.equal(calls,0);
    assert.equal(r.status,'correccion_bloqueada');
    assert(r.errors.some(e=>e.type==='evaluacion_antes_nacimiento'));
  }
});

test('los recuentos derivados pertenecen a cada subárea, no a toda la evaluación',()=>{
  const scoring={...okScoring, respuestas_efectivas:{A1:{puntuacion:2,origen:'basal'},A2:{puntuacion:2,origen:'observado'},A3:{puntuacion:0,origen:'techo'},A4:{puntuacion:0,origen:'observado'}}, subareas:{s1:{...okScoring.subareas.s1,codigos:['A1','A2']}, s2:{...okScoring.subareas.s1,subarea:'Otra',codigos:['A3','A4']}}, escalas:{personal_social_total:{pd:4,pd_parcial:4,maximo:8,completa:true,requiere_revision:false,pendientes:[]},battelle_total:{pd:4,pd_parcial:4,maximo:8,completa:true,requiere_revision:false,pendientes:[]}}};
  const r=runCorrection({assessment:assessment({A2:2,A4:0}),items,model,percentiles:{},equivalentAges:{},scoreAssessment:()=>scoring});
  assert.equal(r.results.subareas.s1.counts.derivedByBasal,1);
  assert.equal(r.results.subareas.s1.counts.derivedByCeiling,0);
  assert.equal(r.results.subareas.s2.counts.derivedByBasal,0);
  assert.equal(r.results.subareas.s2.counts.derivedByCeiling,1);
});
