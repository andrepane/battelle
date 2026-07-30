import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildEquivalentAgeChartModel, equivalentAgeChartLayout, equivalentAgeChartSvg } from '../src/battelle-equivalent-age-chart.js';

const ids=['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
const labels=['Personal/Social','Adaptativa','Motora gruesa','Motora fina','Motora','Comunicación receptiva','Comunicación expresiva','Comunicación','Cognitiva','Battelle total'];
const result=(date='2026-07-30',ageMonths=60)=>({metadata:{assessmentDate:date,ageMonths},rows:ids.map((id,index)=>({id,label:labels[index],equivalentAge:index===3?'55–56':index===8?'—':String(42+index)}))});
const individual=()=>buildEquivalentAgeChartModel({assessments:[{assessment:{id:'actual',assessmentDate:'2026-07-30'},model:result()}],formatId:'piat',title:'Edades equivalentes'});

test('el modelo geométrico reserva etiquetas, trazado y valores dentro de un viewBox coherente',()=>{
 const model=individual(),layout=equivalentAgeChartLayout(model,{width:1280});
 assert.ok(layout.left>=240);assert.ok(layout.right>=100);assert.equal(layout.plotRight,1170);assert.equal(layout.plotWidth,910);
 assert.equal(layout.height,layout.top+model.rows.length*layout.rowHeight+layout.bottom);
 const svg=equivalentAgeChartSvg(model);const viewBox=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
 assert.deepEqual(viewBox,[0,0,layout.width,layout.height]);assert.match(svg,/preserveAspectRatio="xMinYMin meet"/);
 const labelCoordinates=[...svg.matchAll(/class="chart-row-label" x="([^"]+)"/g)].map(match=>Number(match[1]));
 assert.equal(labelCoordinates.length,10);assert.ok(labelCoordinates.every(value=>value>=0));assert.ok(labelCoordinates.every(value=>value===layout.left-18));
});

test('SVG conserva un único título accesible, leyenda superior y etiquetas cronológicas inequívocas',()=>{
 const svg=equivalentAgeChartSvg(individual());
 assert.equal((svg.match(/<title id="equivalent-age-title">/g)||[]).length,1);assert.doesNotMatch(svg,/class="chart-title"/);
 assert.match(svg,/Evaluación · 30\/07\/2026/);assert.match(svg,/Edad cronológica · 60 meses/);assert.match(svg,/Edad cronológica: 60 meses/);assert.doesNotMatch(svg,/>Evaluación: 60 meses</);
 const legendY=[...svg.matchAll(/class="chart-legend[^>]*[\s\S]*? y="(\d+)"/g)].map(match=>Number(match[1]));assert.ok(legendY.every(y=>y<122));
 assert.match(svg,/chart-range/);assert.match(svg,/>55–56</);assert.match(svg,/Sin edad equivalente disponible/);
});

test('comparación diferencia fechas y referencias cronológicas sin una pestaña Series',async()=>{
 const model=buildEquivalentAgeChartModel({assessments:[{assessment:{id:'a',assessmentDate:'2026-01-15'},model:result('2026-01-15',54)},{assessment:{id:'b',assessmentDate:'2026-07-30'},model:result('2026-07-30',60)}],formatId:'piat'});
 const svg=equivalentAgeChartSvg(model);assert.match(svg,/Anterior · 15\/01\/2026/);assert.match(svg,/Actual · 30\/07\/2026/);assert.match(svg,/Edad cronológica anterior: 54 meses/);assert.match(svg,/Edad cronológica actual: 60 meses/);
 const script=await readFile(new URL('../script.js',import.meta.url),'utf8');const comparisonNav=script.match(/class:'result-display-tabs comparison-display-tabs'[\s\S]*?content\);/)[0];assert.doesNotMatch(comparisonNav,/'Series'/);
});

test('DOM declarativo alterna controles por vista sin persistencia ni controles PDF ficticios',async()=>{
 const script=await readFile(new URL('../script.js',import.meta.url),'utf8');
 assert.match(script,/const chart=state\.resultsDisplay==='chart'/);assert.match(script,/chart\?\[RESULT_FORMATS\.piat,RESULT_FORMATS\.mainAreas\]:Object\.values\(RESULT_FORMATS\)/);
 assert.match(script,/chart\?\[\]:\[el\('fieldset',\{\},el\('legend',\{\},'Columnas visibles'/);
 assert.match(script,/state\.resultsDisplay==='table'\?\[el\('button',\{type:'button',id:'copyTableBtn'/);
 assert.doesNotMatch(script,/Incluir gráfico en PDF|includeChartPdf/);
 const toggle=script.match(/if\(e\.target\.matches\('\.result-display-toggle'\)\)[^}]+\}/)[0];assert.doesNotMatch(toggle,/scheduleSave|saveCoordinator|revision|correctionFingerprint/);
});

test('layout DOM ocupa el flujo completo y conserva metadatos responsive',async()=>{
 const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/\.results-panel.*\.results-view\{display:block;width:100%;max-width:none;min-width:0\}/);
 assert.match(css,/\.clinical-metadata\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(175px,1fr\)\);width:100%/);
 assert.match(css,/@media\(max-width:900px\).*\.clinical-metadata\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/@media\(max-width:600px\).*\.clinical-metadata\{grid-template-columns:minmax\(0,1fr\)\}/);
 assert.match(css,/\.result-display-tabs\{display:inline-grid;grid-auto-flow:column/);assert.doesNotMatch(css,/\.result-display-tabs\{[^}]*grid-template-columns:[^}]*1fr 1fr 1fr/);
 assert.match(css,/\.equivalent-age-chart-panel\{display:block;width:100%;max-width:none/);assert.match(css,/\.equivalent-age-chart-scroll\{[^}]*overflow-x:auto/);
});
