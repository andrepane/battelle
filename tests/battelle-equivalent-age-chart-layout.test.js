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
 assert.ok(layout.left>=240);assert.ok(layout.right>=100);assert.equal(layout.plotRight,layout.width-layout.right);assert.equal(layout.plotWidth,layout.plotRight-layout.left);
 assert.equal(layout.height,layout.top+model.rows.length*layout.rowHeight+layout.bottom);
 const svg=equivalentAgeChartSvg(model);const viewBox=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
 assert.deepEqual(viewBox,[0,0,layout.width,layout.height]);assert.match(svg,/preserveAspectRatio="xMinYMin meet"/);
 const labelCoordinates=[...svg.matchAll(/class="chart-row-label" x="([^"]+)"/g)].map(match=>Number(match[1]));
 assert.equal(labelCoordinates.length,10);assert.ok(labelCoordinates.every(value=>value>=0));assert.ok(labelCoordinates.every(value=>value===layout.left-20));
});

test('SVG conserva un único título accesible, leyenda superior y etiquetas cronológicas inequívocas',()=>{
 const svg=equivalentAgeChartSvg(individual());
 assert.equal((svg.match(/<title id="equivalent-age-title">/g)||[]).length,1);assert.doesNotMatch(svg,/class="chart-title"/);
 assert.match(svg,/Evaluación · 30\/07\/2026/);assert.equal((svg.match(/>Edad cronológica · 60 meses</g)||[]).length,1);assert.doesNotMatch(svg,/>Evaluación: 60 meses</);
 assert.match(svg,/chart-marker chart-point series-1/);assert.doesNotMatch(svg,/mejora|empeora/i);
 const legendY=[...svg.matchAll(/class="chart-legend[^>]*[\s\S]*? y="(\d+)"/g)].map(match=>Number(match[1]));assert.ok(legendY.every(y=>y<122));
 assert.match(svg,/chart-range/);assert.match(svg,/>55–56 meses</);assert.match(svg,/Sin edad equivalente disponible/);
});

test('comparación diferencia fechas y referencias cronológicas sin una pestaña Series',async()=>{
 const model=buildEquivalentAgeChartModel({assessments:[{assessment:{id:'a',assessmentDate:'2026-01-15'},model:result('2026-01-15',54)},{assessment:{id:'b',assessmentDate:'2026-07-30'},model:result('2026-07-30',60)}],formatId:'piat'});
 const svg=equivalentAgeChartSvg(model);assert.match(svg,/Anterior · 15\/01\/2026/);assert.match(svg,/Actual · 30\/07\/2026/);assert.match(svg,/Edad anterior · 54 meses/);assert.match(svg,/Edad actual · 60 meses/);
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

test('dumbbell separa capas, conecta solo datos presentes y mantiene jerarquía y rangos',()=>{
 const previous=result('2026-01-15',60),current=result('2026-07-30',60);previous.rows[0].equivalentAge='20';current.rows[0].equivalentAge='44';previous.rows[1].equivalentAge='—';current.rows[1].equivalentAge='48';previous.rows[3].equivalentAge='55–56';current.rows[3].equivalentAge='70–74';
 const snapshot=structuredClone({previous,current});const model=buildEquivalentAgeChartModel({assessments:[{model:previous},{model:current}],formatId:'piat'}),svg=equivalentAgeChartSvg(model);
 assert.deepEqual({previous,current},snapshot);assert.ok(Object.isFrozen(model));
 assert.equal((svg.match(/class="evolution-connector"/g)||[]).length,8);assert.match(svg,/class="chart-marker chart-point series-0"[^>]*>[\s\S]*?class="point-core"[^>]*r="5"/);assert.match(svg,/class="chart-marker chart-point series-1"[^>]*>[\s\S]*?class="point-core"[^>]*r="7"/);
 const range=svg.match(/class="chart-marker chart-range series-1"[\s\S]*?<line class="range-segment range-halo" x1="([^"]+)"[^>]*x2="([^"]+)"/);assert.ok(Number(range[2])>Number(range[1]));assert.match(svg,/>70–74 meses</);
 assert.match(svg,/chart-row-bg chart-row-bg-alt/);assert.match(svg,/class="grid-layer"/);assert.ok(svg.indexOf('chronological-layer')<svg.indexOf('results-layer'));
});

test('coincidencias, ausencias y referencias cronológicas conservan geometría explícita',()=>{
 const same=result('2026-01-15',60),current=result('2026-07-30',60);same.rows[0].equivalentAge=current.rows[0].equivalentAge='52';same.rows[1].equivalentAge='—';
 let svg=equivalentAgeChartSvg(buildEquivalentAgeChartModel({assessments:[{model:same},{model:current}],formatId:'piat'}));
 assert.equal((svg.match(/class="age-line"/g)||[]).length,1);assert.equal((svg.match(/>Edad cronológica · 60 meses</g)||[]).length,1);
 const row=svg.slice(svg.indexOf('>Personal/Social<'),svg.indexOf('>Adaptativa<'));const points=[...row.matchAll(/<circle class="point-core" cx="([^"]+)" cy="([^"]+)" r="(5|7)"/g)];assert.equal(points.length,2);assert.equal(points[0][1],points[1][1]);assert.notEqual(points[0][2],points[1][2]);assert.match(row,/>Sin cambio</);
 const adaptativa=svg.slice(svg.indexOf('>Adaptativa<'),svg.indexOf('>Motora gruesa<'));assert.doesNotMatch(adaptativa,/evolution-connector/);assert.match(adaptativa,/>—</);
 current.metadata.ageMonths=61;svg=equivalentAgeChartSvg(buildEquivalentAgeChartModel({assessments:[{model:same},{model:current}],formatId:'piat'}));assert.equal((svg.match(/class="age-line"/g)||[]).length,2);
 assert.match(svg,/Edad anterior · 60 meses/);assert.match(svg,/Edad actual · 61 meses/);
});

test('tooltip accesible y exportación SVG omiten elementos interactivos externos',async()=>{
 const a=result('2026-01-15',54),b=result('2026-07-30',60);a.rows[0].equivalentAge='52';b.rows[0].equivalentAge='65';b.rows[3].equivalentAge='90–95';
 const html=equivalentAgeChartSvg(buildEquivalentAgeChartModel({assessments:[{model:a},{model:b}],formatId:'piat'}));
 assert.match(html,/tabindex="0" role="group"[^>]*data-tooltip="Personal\/Social[\s\S]*Diferencia[ ]+\+13 meses/);
 const intervalStart=html.indexOf('data-tooltip="Motora fina'),intervalEnd=html.indexOf('><',intervalStart);assert.doesNotMatch(html.slice(intervalStart,intervalEnd),/Diferencia entre resultados/);
 const exported=html.slice(html.indexOf('<svg'),html.indexOf('</svg>')+6);assert.doesNotMatch(exported,/chart-tooltip|button|copy-chart|download-chart/);
 const source=await readFile(new URL('../src/battelle-equivalent-age-chart.js',import.meta.url),'utf8');assert.match(source,/event\.key==='Escape'/);
});


test('franjas modernas preservan orden, alternancia, foco, jerarquía y cuadrícula mínima',()=>{
 const model=individual(),svg=equivalentAgeChartSvg(model);const rows=[...svg.matchAll(/<g class="chart-row hierarchy-([^"]+)"/g)];
 assert.equal(rows.length,model.rows.length);assert.deepEqual([...svg.matchAll(/class="chart-row-label"[^>]*>([^<]+)/g)].map(match=>match[1]),labels);assert.ok((svg.match(/chart-row-bg-alt/g)||[]).length>=5);assert.equal((svg.match(/<line class="chart-grid"/g)||[]).length,5);assert.match(svg,/\.chart-row:focus \.chart-row-bg/);assert.match(svg,/hierarchy-component/);assert.match(svg,/hierarchy-grand-total/);
});

test('puntos, halos, cápsulas y diferencias neutrales se representan sin semántica clínica inventada',()=>{
 const a=result('2026-01-15',60),b=result('2026-07-30',60);a.rows[0].equivalentAge='52';b.rows[0].equivalentAge='65';a.rows[1].equivalentAge=b.rows[1].equivalentAge='44';a.rows[2].equivalentAge='40–42';b.rows[2].equivalentAge='48';
 const svg=equivalentAgeChartSvg(buildEquivalentAgeChartModel({assessments:[{model:a},{model:b}],formatId:'piat'}));assert.match(svg,/point-halo/);assert.match(svg,/range-segment range-halo/);assert.match(svg,/difference-chip/);assert.match(svg,/>\+13 meses</);assert.match(svg,/>Sin cambio</);assert.doesNotMatch(svg,/mejoría|empeoramiento|avance|retroceso|recuperación/i);assert.doesNotMatch(svg,/\bgreen\b|\bred\b/i);
});

test('tooltip individual calcula diferencia solo para punto y el intervalo la omite',()=>{
 const svg=equivalentAgeChartSvg(individual());const pointStart=svg.indexOf('data-tooltip="Personal/Social'),point=svg.slice(pointStart,svg.indexOf('"><rect',pointStart));assert.match(point,/Diferencia descriptiva/);const rangeStart=svg.indexOf('data-tooltip="Motora fina'),range=svg.slice(rangeStart,svg.indexOf('"><rect',rangeStart));assert.doesNotMatch(range,/Diferencia descriptiva/);
});
