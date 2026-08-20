import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEquivalentAgeChartModel, equivalentAgeBarGeometry, equivalentAgeChartLayout, equivalentAgeChartSvg } from '../src/battelle-equivalent-age-chart.js';

const ids=['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
const labels=['Personal/Social','Adaptativa','Motora gruesa','Motora fina','Motora','Comunicación receptiva','Comunicación expresiva','Comunicación','Cognitiva','Battelle total'];
const result=(date='2026-07-30',ageMonths=60,values={})=>({metadata:{assessmentDate:date,ageMonths},rows:ids.map((id,index)=>({id,label:labels[index],equivalentAge:values[id]??String(42+index)}))});
const individual=(values={})=>buildEquivalentAgeChartModel({assessments:[{assessment:{id:'actual',assessmentDate:'2026-07-30'},model:result('2026-07-30',60,values)}],formatId:'piat',title:'Edades equivalentes'});
const comparison=(previous={},current={},ages=[54,60])=>buildEquivalentAgeChartModel({assessments:[{assessment:{id:'a',assessmentDate:'2026-01-15'},model:result('2026-01-15',ages[0],previous)},{assessment:{id:'b',assessmentDate:'2026-07-30'},model:result('2026-07-30',ages[1],current)}],formatId:'piat',title:'Edades equivalentes'});

test('geometría vertical empieza en cero, incluye máximos y escala proporcional',()=>{
 const model=individual({motora_fina:'90–95'}),geometry=equivalentAgeBarGeometry(model);
 assert.equal(geometry.axisMin,0);assert.ok(geometry.axisMax>=95);assert.ok(geometry.axisMax>=60);assert.equal(geometry.groups.length,10);assert.equal(geometry.groups[0].bars[0].baseline,geometry.plotBottom);
 assert.equal(geometry.y(0),geometry.plotBottom);assert.ok(geometry.y(80)<geometry.y(40));assert.ok(Math.abs((geometry.y(40)-geometry.y(80))-(geometry.y(0)-geometry.y(40)))<1e-9);
 const layout=equivalentAgeChartLayout(model);assert.equal(layout.height,720);assert.ok(layout.plotBottom+70<layout.height);
});

test('ancho mínimo depende de categorías y modo comparativo',()=>{
 const single=equivalentAgeChartLayout(individual()),dual=equivalentAgeChartLayout(comparison());assert.ok(dual.width>single.width);
 const main=buildEquivalentAgeChartModel({assessments:[{model:result()}],formatId:'mainAreas'});assert.ok(equivalentAgeChartLayout(main).width<single.width);
});

test('individual crea barras desde cero, intervalo segmentado y ausencia sin barra cero',()=>{
 const model=individual({personal_social_total:'65',adaptativa_total:'90–95',cognitiva_total:'—'}),geometry=equivalentAgeBarGeometry(model),svg=equivalentAgeChartSvg(model);
 assert.equal((svg.match(/class="vertical-bar series-1"/g)||[]).length,9);assert.match(svg,/Personal\/Social: edad equivalente de 65 meses/);assert.match(svg,/class="bar-solid"/);assert.match(svg,/>65</);
 assert.match(svg,/class="bar-interval"/);assert.match(svg,/class="interval-limit"/);assert.match(svg,/>90–95</);assert.doesNotMatch(svg,/92[,.]5/);
 const range=geometry.groups[1].bars[0];assert.ok(range.rangeTop<range.solidTop);assert.equal(range.baseline,geometry.plotBottom);
 const missing=svg.slice(svg.indexOf('data-tooltip="Cognitiva'),svg.indexOf('</g>',svg.indexOf('data-tooltip="Cognitiva')));assert.match(missing,/>—</);assert.doesNotMatch(missing,/vertical-bar/);
});

test('comparativo agrupa dos posiciones sin solape, conexión ni flechas',()=>{
 const model=comparison({personal_social_total:'52',adaptativa_total:'—',motora_fina:'50–52'},{personal_social_total:'65',adaptativa_total:'48',motora_fina:'60–64'}),geometry=equivalentAgeBarGeometry(model),svg=equivalentAgeChartSvg(model);
 for(const group of geometry.groups){assert.equal(group.bars.length,2);assert.ok(group.bars[0].x+group.bars[0].width<group.bars[1].x);assert.equal(group.bars[0].baseline,group.bars[1].baseline);}
 assert.match(svg,/vertical-bar series-0/);assert.match(svg,/vertical-bar series-1/);assert.match(svg,/Anterior · 15\/01\/2026/);assert.match(svg,/Actual · 30\/07\/2026/);
 assert.doesNotMatch(svg,/evolution-connector|dumbbell|marker-end|arrow|flecha/i);assert.ok(svg.indexOf('<g class="bars-layer">')<svg.indexOf('<g class="chronological-layer">'));assert.ok(svg.indexOf('<g class="chronological-layer">')<svg.indexOf('<g class="chronological-label-layer">'));
});

test('coincidencias conservan dos barras y ausencia reserva cada posición',()=>{
 const model=comparison({personal_social_total:'52',adaptativa_total:'—'},{personal_social_total:'52',adaptativa_total:'48'},[60,60]),geometry=equivalentAgeBarGeometry(model),svg=equivalentAgeChartSvg(model);
 const same=geometry.groups[0].bars;assert.notEqual(same[0].x,same[1].x);assert.equal(same[0].solidTop,same[1].solidTop);assert.match(svg,/Sin diferencia entre resultados/);
 assert.equal(geometry.groups[1].bars.length,2);assert.equal(geometry.groups[1].bars[0].value.numeric,false);assert.equal(geometry.groups[1].bars[1].value.numeric,true);
});

test('cronología usa líneas horizontales únicas o dobles y separa etiquetas próximas',()=>{
 let svg=equivalentAgeChartSvg(comparison({}, {},[60,60]));assert.equal((svg.match(/class="chronological-line"/g)||[]).length,1);assert.match(svg,/>Edad cronológica · 60 meses</);
 svg=equivalentAgeChartSvg(comparison({}, {},[60,61]));assert.equal((svg.match(/class="chronological-line"/g)||[]).length,2);assert.match(svg,/Edad anterior · 60 meses/);assert.match(svg,/Edad actual · 61 meses/);
 const refs=[...svg.matchAll(/class="chronological-label" x="([^"]+)" y="([^"]+)" text-anchor="([^"]+)"/g)];assert.equal(refs.length,2);assert.notEqual(refs[0][1],refs[1][1]);assert.notEqual(refs[0][3],refs[1][3]);
 assert.doesNotMatch(svg,/x1="[^\"]+" y1="150" x2="\1"/);
});

test('referencias cronológicas quedan sobre barras, hover y Battelle total a cualquier ancho',()=>{
 for(const width of [320,768,1440]){
  const svg=equivalentAgeChartSvg(individual({personal_social_total:'40',adaptativa_total:'60',motora_gruesa:'75',battelle_total:'90'}),{width});
  const bars=svg.indexOf('<g class="bars-layer">'),lines=svg.indexOf('<g class="chronological-layer">'),labels=svg.indexOf('<g class="chronological-label-layer">');
  assert.ok(bars<lines&&lines<labels);assert.match(svg,/hierarchy-grand-total/);assert.match(svg,/chronological-label-background/);assert.match(svg,/chronological-layer,.chronological-label-layer\{pointer-events:none\}/);
  const label=[...svg.matchAll(/class="chronological-label" x="([\d.]+)" y="([\d.]+)"/g)][0];assert.ok(Number(label[1])>=86&&Number(label[1])<=equivalentAgeChartLayout(individual(),{width}).width-28);assert.ok(Number(label[2])>=150);
 }
});

test('etiquetas completas se dividen sin rotación y conservan jerarquía',()=>{
 const svg=equivalentAgeChartSvg(individual());for(const label of labels){for(const word of label.split(' '))assert.match(svg,new RegExp(`>${word.replace('/','\\/')}<|>${label.replace('/','\\/')}<`));}
 assert.match(svg,/<tspan[^>]*>Comunicación<\/tspan><tspan[^>]*>receptiva<\/tspan>/);assert.match(svg,/<tspan[^>]*>Motora<\/tspan><tspan[^>]*>fina<\/tspan>/);assert.doesNotMatch(svg,/x-label[^>]*transform=.*rotate\(-?90/);assert.match(svg,/hierarchy-component/);assert.match(svg,/hierarchy-grand-total/);
});

test('tooltips de barra respetan punto, intervalo, teclado y exportación',async()=>{
 const point=equivalentAgeChartSvg(individual({personal_social_total:'65'}));assert.match(point,/data-tooltip="Personal\/Social[\s\S]*Edad equivalente: 65 meses[\s\S]*Edad cronológica: 60 meses[\s\S]*Diferencia descriptiva: \+5 meses/);
 const ranged=equivalentAgeChartSvg(individual({adaptativa_total:'90–95'}));const start=ranged.indexOf('data-tooltip="Adaptativa'),tooltip=ranged.slice(start,ranged.indexOf('"><rect',start));assert.match(tooltip,/90–95 meses/);assert.doesNotMatch(tooltip,/Diferencia descriptiva/);
 assert.match(point,/tabindex="0" role="group"/);const exported=point.slice(point.indexOf('<svg'),point.indexOf('</svg>')+6);assert.match(exported,/vertical-age-chart/);assert.doesNotMatch(exported,/chart-tooltip|button|copy-chart|download-chart/);
 const source=await readFile(new URL('../src/battelle-equivalent-age-chart.js',import.meta.url),'utf8');assert.match(source,/event\.key==='Escape'/);
});

test('panel responsive y cambios de vista no persisten',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8'),script=await readFile(new URL('../script.js',import.meta.url),'utf8');assert.match(css,/\.equivalent-age-chart-scroll\{[^}]*overflow-x:auto/);assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);const source=await readFile(new URL('../src/battelle-equivalent-age-chart.js',import.meta.url),'utf8');assert.match(source,/style="min-width:\$\{width\}px"/);
 const toggle=script.match(/if\(e\.target\.matches\('\.result-display-toggle'\)\)[^}]+\}/)[0];assert.doesNotMatch(toggle,/scheduleSave|saveCoordinator|revision|correctionFingerprint/);assert.match(script,/chartPngBlob\(svg\)/);
});
