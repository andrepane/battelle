import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAndNormalizeItems } from '../src/battelle-data.js';
import { loadScaleModel } from '../src/battelle-scales.js';
import { validateResponse, scoreAssessment, detectBasal } from '../src/battelle-scoring.js';
const items = await loadAndNormalizeItems(); const model = await loadScaleModel();
const sub = (area, subarea)=>items.filter(i=>i.area===area&&i.subarea===subarea);

test('respuestas: null no suma, acepta 0/1/2, rechaza otros y no muta', () => {
  [0,1,2].forEach(v=>assert.equal(validateResponse(v), v)); assert.throws(()=>validateResponse(3));
  const original = {'PS 1': 1}; const copy=structuredClone(original); const r=scoreAssessment(items, model, original);
  assert.deepEqual(original, copy); assert.equal(r.respuestas_efectivas.PS2.puntuacion, null);
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.pd, null); assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.pd_parcial, 1);
});

test('basal exige todos los ítems del nivel, admite nivel unitario y deriva solo niveles inferiores', () => {
  let r=scoreAssessment(items, model, {PS14:2,PS15:2});
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.basal.confirmado, true);
  assert.equal(r.respuestas_efectivas.PS13.origen, 'basal');
  assert.equal(r.respuestas_efectivas.PS16.origen, null);
  r=scoreAssessment(items, model, {PS6:2,PS7:2});
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.basal.confirmado, false);
  assert.deepEqual(r.subareas.personal_social_interaccion_con_el_adulto.basal.pendientes,['PS8']);
  r=scoreAssessment(items, model, {PS6:2,PS7:2,PS8:2});
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.basal.confirmado, true);
  r=scoreAssessment(items, model, {PS13:2});
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.basal.confirmado, true);
  assert.deepEqual(r.subareas.personal_social_interaccion_con_el_adulto.basal.sustentan,['PS13']);
  r=scoreAssessment(items, model, {PS1:1,PS14:2,PS15:2});
  assert.equal(r.respuestas_efectivas.PS1.puntuacion, 1); assert.equal(r.respuestas_efectivas.PS1.origen,'observado');
  assert.equal(r.inconsistencias.some(w=>w.tipo==='inconsistencia_basal'), false);
  assert.equal(r.advertencias.some(w=>w.tipo==='discrepancia_basal'), true);
});

test('ejemplo clínico: cuatro ítems 36–47 requieren cuatro doses y se retrocede al nivel aprobado',()=>{
  const level=(code,min,max)=>({codigo_canonico:code,rango_edad:`${min}-${max}`,rango_edad_min_meses:min,rango_edad_max_meses:max});
  const sample=[level('CR10',24,35),level('CR11',36,47),level('CR12',36,47),level('CR13',36,47),level('CR14',36,47)];
  let observed={CR11:{puntuacion:2},CR12:{puntuacion:2}};
  assert.equal(detectBasal(sample,observed).confirmado,false);
  observed={CR11:{puntuacion:2},CR12:{puntuacion:2},CR13:{puntuacion:2},CR14:{puntuacion:2}};
  assert.equal(detectBasal(sample,observed).confirmado,true);
  observed={CR10:{puntuacion:2},CR11:{puntuacion:1},CR12:{puntuacion:2},CR13:{puntuacion:2},CR14:{puntuacion:2}};
  const backedUp=detectBasal(sample,observed); assert.equal(backedUp.confirmado,true); assert.equal(backedUp.rango_edad,'24-35');
});

test('techo usa ceros observados consecutivos incluso entre niveles y rechaza 0,1,0', () => {
  const basal={PS1:2,PS2:2,PS3:2,PS4:2,PS5:2};
  let r=scoreAssessment(items, model, {...basal,PS8:0,PS9:0});
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.techo.confirmado, true);
  assert.deepEqual(r.subareas.personal_social_interaccion_con_el_adulto.techo.sustentan,['PS8','PS9']);
  assert.equal(r.respuestas_efectivas.PS10.origen, 'techo');
  r=scoreAssessment(items, model, {...basal,PS8:0,PS9:1,PS10:0});
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.techo.confirmado, false);
  r=scoreAssessment(items, model, {...basal,PS8:0,PS9:0,PS10:1});
  assert.equal(r.respuestas_efectivas.PS10.puntuacion, 1); assert.equal(r.respuestas_efectivas.PS10.origen,'observado');
  assert.equal(r.inconsistencias.some(w=>w.tipo==='inconsistencia_techo'), true);
});

test('cambiar sustentos invalida basal o techo y elimina derivaciones sin tocar observaciones',()=>{
  let responses={PS6:2,PS7:2,PS8:2}; let r=scoreAssessment(items,model,responses);
  assert.equal(r.respuestas_efectivas.PS1.origen,'basal'); responses={...responses,PS8:1}; r=scoreAssessment(items,model,responses);
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.basal.confirmado,false); assert.equal(r.respuestas_efectivas.PS1.origen,null);
  responses={PS1:2,PS2:2,PS3:2,PS4:2,PS5:2,PS8:0,PS9:0}; r=scoreAssessment(items,model,responses);
  assert.equal(r.respuestas_efectivas.PS10.origen,'techo'); responses={...responses,PS9:1}; r=scoreAssessment(items,model,responses);
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.techo.confirmado,false); assert.equal(r.respuestas_efectivas.PS10.origen,null);
  assert.deepEqual(Object.fromEntries(Object.entries(r.respuestas_observadas).map(([k,v])=>[k,v.puntuacion])),responses);
});

test('completitud: huecos internos invalidan PD y evaluación; cobertura completa valida', () => {
  let r=scoreAssessment(items, model, {'PS 1':2,'PS 2':2,'PS 6':0,'PS 7':0});
  assert.equal(r.subareas.personal_social_interaccion_con_el_adulto.pd, null); assert.equal(typeof r.subareas.personal_social_interaccion_con_el_adulto.pd_parcial, 'number'); assert.equal(r.escalas.personal_social_total.pd, null); assert.equal(r.escalas.battelle_total.pd, null);
  const all2=Object.fromEntries(items.map(i=>[i.codigo_canonico,2])); r=scoreAssessment(items, model, all2);
  assert.equal(r.evaluacion_completa, true); assert.equal(r.escalas.battelle_total.pd, 682);
});

test('agregados sintéticos completos y sin doble conteo', () => {
  const responses=Object.fromEntries(items.map(i=>[i.codigo_canonico, i.area==='Motora'?1:2])); const r=scoreAssessment(items, model, responses);
  assert.equal(r.subareas.motora_control_muscular.pd, sub('Motora','Control muscular').length);
  assert.equal(r.escalas.personal_social_total.pd, 170); assert.equal(r.escalas.adaptativa_total.pd, 118);
  assert.equal(r.escalas.motora_gruesa.pd, 44); assert.equal(r.escalas.motora_fina.pd, 38); assert.equal(r.escalas.motora_total.pd, 82);
  assert.equal(r.escalas.comunicacion_total.pd, 118); assert.equal(r.escalas.cognitiva_total.pd, 112); assert.equal(r.escalas.battelle_total.pd, 600);
});

test('PS999 se rechaza como código desconocido', () => {
  const r = scoreAssessment(items, model, { PS999: 2 });
  assert.equal(r.errores.length, 1);
  assert.match(r.errores[0].mensaje, /desconocido/);
});

test('una clave vacía se rechaza', () => {
  const r = scoreAssessment(items, model, { '': 2 });
  assert.equal(r.errores.length, 1);
  assert.match(r.errores[0].mensaje, /vacío/);
});

test('PS1 y PS 1 juntos se rechazan como duplicado canónico', () => {
  const r = scoreAssessment(items, model, { PS1: 2, 'PS 1': 2 });
  assert.equal(r.errores.length, 1);
  assert.match(r.errores[0].mensaje, /duplicado/);
});

test('una respuesta desconocida no aparece en respuestas_efectivas', () => {
  const r = scoreAssessment(items, model, { XX1: 2 });
  assert.equal(r.errores.length, 1);
  assert.equal(Object.hasOwn(r.respuestas_efectivas, 'XX1'), false);
});

test('normalizeItemCode se usa para todas las entradas aceptadas', () => {
  const r = scoreAssessment(items, model, { 'PS 1': 2 });
  assert.equal(r.errores.length, 0);
  assert.equal(r.respuestas_observadas.PS1.puntuacion, 2);
  assert.equal(Object.hasOwn(r.respuestas_observadas, 'PS 1'), false);
});

test('un 0 o 1 observado inferior al basal prevalece, advierte y permite calcular la PD', () => {
  for(const score of [0,1]){
    const r=scoreAssessment(items,model,{PS1:score,PS14:2,PS15:2,PS16:0,PS17:0});
    const s=r.subareas.personal_social_interaccion_con_el_adulto;
    assert.equal(r.respuestas_efectivas.PS1.puntuacion,score);
    assert.equal(r.respuestas_efectivas.PS1.origen,'observado');
    assert.equal(s.requiere_revision,false);
    assert.equal(s.completa,true);
    assert.equal(s.pd,28+score);
    assert.equal(s.advertencias.some((w)=>w.tipo==='discrepancia_basal'&&w.codigo==='PS1'),true);
  }
});

test('una observación inferior al basal no bloquea aunque no haya pendientes', () => {
  const adulto = sub('Personal/Social', 'Interacción con el adulto');
  const responses = Object.fromEntries(adulto.map((i)=>[i.codigo_canonico, 2]));
  responses.PS1 = 1;
  responses.PS6 = 2;
  responses.PS7 = 2;
  const r = scoreAssessment(items, model, responses);
  const s = r.subareas.personal_social_interaccion_con_el_adulto;
  assert.equal(s.pendientes.length, 0);
  assert.equal(s.pd, adulto.length*2-1);
  assert.equal(s.requiere_revision, false);
  assert.equal(s.advertencias.length,1);
});

test('una contradicción posterior al techo deja pd null aunque no haya pendientes', () => {
  const adulto = sub('Personal/Social', 'Interacción con el adulto');
  const responses = Object.fromEntries(adulto.map((i)=>[i.codigo_canonico, 0]));
  responses.PS1 = 2; responses.PS2 = 2; responses.PS6 = 0; responses.PS7 = 0; responses.PS9 = 1;
  const r = scoreAssessment(items, model, responses);
  const s = r.subareas.personal_social_interaccion_con_el_adulto;
  assert.equal(s.pendientes.length, 0);
  assert.equal(s.pd, null);
  assert.equal(s.requiere_revision, true);
});

test('un techo provisional sin basal deja pd null', () => {
  const responses = { PS1: 1, PS2: 1, PS3: 1, PS4: 1, PS5: 1, PS6: 0, PS7: 0 };
  const r = scoreAssessment(items, model, responses);
  const s = r.subareas.personal_social_interaccion_con_el_adulto;
  assert.equal(s.techo.provisional, true);
  assert.equal(s.requiere_revision, true);
  assert.equal(s.pd, null);
});

test('un agregado permanece válido ante una advertencia basal no bloqueante', () => {
  const responses = Object.fromEntries(items.map((i)=>[i.codigo_canonico, 2]));
  responses.PS1 = 1; responses.PS6 = 2; responses.PS7 = 2;
  const r = scoreAssessment(items, model, responses);
  assert.equal(r.escalas.personal_social_total.requiere_revision, false);
  assert.equal(r.escalas.personal_social_total.pd, 169);
});

test('Battelle total permanece válido ante una advertencia basal no bloqueante', () => {
  const responses = Object.fromEntries(items.map((i)=>[i.codigo_canonico, 2]));
  responses.PS1 = 1; responses.PS6 = 2; responses.PS7 = 2;
  const r = scoreAssessment(items, model, responses);
  assert.equal(r.escalas.battelle_total.requiere_revision, false);
  assert.equal(r.escalas.battelle_total.pd, 681);
});

test('un caso completo sin contradicciones sigue produciendo Battelle total 682', () => {
  const responses = Object.fromEntries(items.map((i)=>[i.codigo_canonico, 2]));
  const r = scoreAssessment(items, model, responses);
  assert.equal(r.escalas.battelle_total.pd, 682);
  assert.equal(r.escalas.battelle_total.requiere_revision, false);
});
