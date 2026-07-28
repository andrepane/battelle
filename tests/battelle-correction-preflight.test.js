import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCorrectionPreflight} from '../src/battelle-correction-preflight.js';

const sub=(area='Motora',subarea='Motora fina',extra={})=>({area,subarea,completa:true,...extra});
const inspection=(extra={})=>({ok:true,fingerprint:'one',scoring:{subareas:{fine:sub()},respuestas_efectivas:{M1:{origen:'observado'},M2:{origen:'basal'},M3:{origen:'techo'}},advertencias:[]},pendingReport:{total:0,items:[]},errors:[],inconsistencies:[],...extra});

test('evaluación lista usa únicamente conteos del estado clínico',()=>{const m=buildCorrectionPreflight(inspection());assert.equal(m.status,'ready');assert.equal(m.allowed,true);assert.deepEqual(m.counts,{readySubareas:1,totalSubareas:1,observed:1,derivedByBasal:1,derivedByCeiling:1,warnings:0,blockers:0});});
test('discrepancias basales permiten corregir y se agrupan por subárea',()=>{const i=inspection();i.scoring.advertencias=[{tipo:'discrepancia_basal',codigo:'M0',subarea:'Motora|Motora fina',mensaje:'observada inferior al basal'},{tipo:'discrepancia_basal',codigo:'M1',subarea:'Motora|Motora fina',mensaje:'observada inferior al basal'}];const m=buildCorrectionPreflight(i);assert.equal(m.status,'warnings');assert.equal(m.allowed,true);assert.equal(m.warnings.length,1);assert.equal(m.warnings[0].count,2);});
test('bloqueo identifica el primer ítem revisable',()=>{const i=inspection({ok:false,errors:[{type:'requiere_revision',area:'Motora',subarea:'Motora fina',code:'M7',message:'Contradicción clínica.'}]});const m=buildCorrectionPreflight(i);assert.equal(m.status,'blocked');assert.equal(m.allowed,false);assert.deepEqual(m.firstReviewTarget,{area:'Motora',subarea:'Motora fina',code:'M7'});});
test('bloqueo de subárea sin ítem conserva destino de cabecera',()=>{const i=inspection({ok:false,errors:[{type:'subarea_incompleta',area:'Cognitiva',subarea:'Atención',message:'Techo no confirmado.'}]});assert.deepEqual(buildCorrectionPreflight(i).firstReviewTarget,{area:'Cognitiva',subarea:'Atención',code:null});});
test('construir el modelo no muta respuestas ni puntuaciones',()=>{const i=inspection();i.scoring.subareas.fine.pd=2;i.scoring.escalas={motora_total:{pd:2,pc:50,z:0,T:50,CI:100,ECN:50,edadEquivalente:20}};const before=structuredClone(i);buildCorrectionPreflight(i);assert.deepEqual(i,before);});
