import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEquivalentAgeChartModel, equivalentAgeChartSvg, parseEquivalentAge, safeChartFilename, copyChartPng } from '../src/battelle-equivalent-age-chart.js';

const ids=['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
const labels=['Personal/Social','Adaptativa','Motora gruesa','Motora fina','Motora','Comunicación receptiva','Comunicación expresiva','Comunicación','Cognitiva','Battelle total'];
function result(values={},ageMonths=52,date='2026-01-15'){return {metadata:{ageMonths,assessmentDate:date},rows:ids.map((id,i)=>({id,label:labels[i],equivalentAge:values[id]??String(30+i)}))};}

test('modelo canónico contiene seis áreas principales y diez filas PIAT en orden',()=>{
 const assessment={id:'a',assessmentDate:'2026-01-15'};const model=result();
 const main=buildEquivalentAgeChartModel({assessments:[{assessment,model}],formatId:'mainAreas'});
 assert.deepEqual(main.rows.map(r=>r.id),['personal_social_total','adaptativa_total','motora_total','comunicacion_total','cognitiva_total','battelle_total']);
 const piat=buildEquivalentAgeChartModel({assessments:[{assessment,model}],formatId:'piat'});
 assert.equal(piat.rows.length,10);assert.equal(piat.rows[3].id,'motora_fina');assert.ok(Object.isFrozen(piat));
});

test('punto, intervalo literal, ausente y error tienen semántica explícita',()=>{
 assert.deepEqual(parseEquivalentAge('52'),{kind:'point',text:'52',numeric:true,min:52,max:52,value:52,accessibleText:'52 meses'});
 const range=parseEquivalentAge('55–56');assert.equal(range.min,55);assert.equal(range.max,56);assert.equal(range.text,'55–56');assert.equal(range.value,null);
 const missing=parseEquivalentAge('—');assert.equal(missing.kind,'missing');assert.equal(missing.value,null);assert.notEqual(missing.value,0);
 const error=parseEquivalentAge('error técnico');assert.equal(error.kind,'error');assert.equal(error.numeric,false);
});

test('modelo es puro, usa edad corregida y separa evaluaciones por fecha',()=>{
 const previous=result({motora_fina:'55-56'},48,'2026-01-15'),current=result({motora_fina:'—'},54,'2026-07-20');const before=structuredClone(previous);
 const chart=buildEquivalentAgeChartModel({assessments:[{assessment:{id:'a',assessmentDate:'2026-01-15'},model:previous},{assessment:{id:'b',assessmentDate:'2026-07-20'},model:current}],formatId:'piat'});
 assert.deepEqual(previous,before);assert.equal(chart.series.length,2);assert.deepEqual(chart.series.map(s=>s.chronologicalAge),[48,54]);assert.match(chart.series[0].label,/15\/01\/2026/);assert.match(chart.series[1].label,/20\/07\/2026/);
 assert.equal(chart.differences.motora_fina,null);assert.equal(chart.rows[3].series[1].kind,'missing');
});

test('diferencia solo para dos puntos utiliza etiqueta descriptiva prudente',()=>{
 const chart=buildEquivalentAgeChartModel({assessments:[{assessment:{assessmentDate:'2026-01-15'},model:result({motora_fina:'40'})},{assessment:{assessmentDate:'2026-07-20'},model:result({motora_fina:'43'})}],formatId:'piat'});
 assert.equal(chart.differences.motora_fina,'Diferencia entre resultados: +3 meses');assert.doesNotMatch(chart.differences.motora_fina,/mejor/i);
});

test('SVG accesible dibuja rangos, referencias y no ubica ausentes en cero',()=>{
 const chart=buildEquivalentAgeChartModel({assessments:[{assessment:{assessmentDate:'2026-01-15'},model:result({motora_fina:'55–56',cognitiva_total:'—'})},{assessment:{assessmentDate:'2026-07-20'},model:result({},58)}],formatId:'piat'});
 const svg=equivalentAgeChartSvg(chart);assert.match(svg,/<title id=/);assert.match(svg,/<desc id=/);assert.match(svg,/chart-range/);assert.match(svg,/Edad cronológica|Anterior: 52 meses/);assert.match(svg,/Motora fina/);assert.match(svg,/Comunicación receptiva/);assert.match(svg,/Sin edad equivalente disponible/);assert.doesNotMatch(svg,/aria-label="[^"]*Sin edad equivalente disponible[^"]*"[^>]*><circle[^>]*cx="235"/);assert.match(svg,/stroke-dasharray/);
});

test('archivo es seguro y portapapeles comunica los errores',async()=>{
 const chart=buildEquivalentAgeChartModel({assessments:[{assessment:{assessmentDate:'2026-01-15'},model:result()}],formatId:'piat',patient:'Niña / Uno'});
 assert.equal(safeChartFilename(chart),'Battelle_grafico_edades_equivalentes_Nina_Uno_2026-01-15.png');
 await assert.rejects(copyChartPng(new Blob(),{clipboard:null,ClipboardItemCtor:null}),/unavailable/);
 let written=false;class Item{constructor(value){this.value=value;}}await copyChartPng(new Blob(),{clipboard:{write:async()=>{written=true;}},ClipboardItemCtor:Item});assert.equal(written,true);
});
