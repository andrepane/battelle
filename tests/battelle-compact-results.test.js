import test from 'node:test';
import assert from 'node:assert/strict';
import { copyResultTable, createResultPresentation, RESULT_FORMATS, resultRowOrder, serializeResultTable, serializeResultTableHtml } from '../src/battelle-result-table.js';
import { generateBattellePdf } from '../src/battelle-pdf.js';

const rows=resultRowOrder().map((id,index)=>({id,label:`FULL ${id}`,canonicalLabel:id,type:id==='battelle_total'?'grand-total':id.endsWith('_total')||['motora_gruesa','motora_fina','comunicacion_receptiva','comunicacion_expresiva'].includes(id)?'total':'subarea',pd:id==='motora_fina'?38:index,pc:null,z:undefined,T:50,CI:100,ECN:50,equivalentAge:id==='motora_fina'?'34 meses':'—'}));
const base={rows,metadata:{name:'Caso',assessmentDate:'2026-07-28',display:{}},warnings:[],conclusion:{ok:true,text:'Conclusión clínica sin cambios.',note:'Nota.'}};
const ids=view=>view.rows.map(row=>row.id);
const pdf=view=>new TextDecoder('latin1').decode(generateBattellePdf(view));

test('formatos explícitos seleccionan 10, 6 y 30 filas en orden estable',()=>{
 const piat=createResultPresentation(base,{formatId:'piat'}),main=createResultPresentation(base,{formatId:'mainAreas'}),complete=createResultPresentation(base,{formatId:'complete'});
 assert.deepEqual(ids(piat),['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total']);
 assert.deepEqual(ids(main),['personal_social_total','adaptativa_total','motora_total','comunicacion_total','cognitiva_total','battelle_total']);
 assert.deepEqual(ids(complete),resultRowOrder());assert.equal(complete.rows.length,30);
 assert.equal(piat.rows.find(row=>row.id==='motora_fina').pd,38);assert.equal(piat.rows.find(row=>row.id==='motora_fina').equivalentAge,'34 meses');
 assert.ok(!piat.rows.some(row=>row.id==='adaptativa_atencion'));assert.ok(!main.rows.some(row=>row.id==='motora_fina'));
});
test('cada formato recibe su jerarquía visual por identificador canónico sin alterar valores',()=>{
 const piat=createResultPresentation(base,{formatId:'piat'}),main=createResultPresentation(base,{formatId:'mainAreas'}),complete=createResultPresentation(base,{formatId:'complete'});
 const piatTypes=Object.fromEntries(piat.rows.map(row=>[row.id,row.type]));
 for(const id of ['motora_gruesa','motora_fina','comunicacion_receptiva','comunicacion_expresiva'])assert.equal(piatTypes[id],'component');
 for(const id of ['motora_total','comunicacion_total'])assert.equal(piatTypes[id],'total');
 assert.equal(piatTypes.battelle_total,'grand-total');
 for(const id of ['personal_social_total','adaptativa_total','motora_total','comunicacion_total','cognitiva_total'])assert.equal(main.rows.find(row=>row.id===id).type,'total');
 assert.equal(main.rows.find(row=>row.id==='battelle_total').type,'grand-total');
 assert.equal(complete.rows.find(row=>row.id==='motora_gruesa').type,'total');assert.equal(complete.rows.find(row=>row.id==='motora_fina').type,'total');
 const clinicalFields=['pd','pc','z','T','CI','ECN','equivalentAge'];
 for(const view of [piat,main,complete])for(const row of view.rows){const original=base.rows.find(candidate=>candidate.id===row.id);for(const field of clinicalFields)assert.equal(row[field],original[field]);}
});
test('filas y columnas son decisiones independientes y Área es obligatoria',()=>{
 const custom=createResultPresentation(base,{formatId:'piat',columns:['pc','T']});assert.equal(custom.rows.length,10);assert.deepEqual(custom.columns.map(c=>c.id),['label','pc','T']);
 const reset=createResultPresentation(base,{formatId:'mainAreas'});assert.equal(reset.rows.length,6);assert.deepEqual(reset.columns.map(c=>c.id),RESULT_FORMATS.mainAreas.defaultColumns);
});
test('HTML y texto tabulado comparten exclusivamente el mismo modelo seguro',()=>{
 const view=createResultPresentation(base,{formatId:'mainAreas',columns:['pd','equivalentAge']});const plain=serializeResultTable(view),html=serializeResultTableHtml(view);
 assert.match(html,/^<table[^>]*><thead><tr>/);assert.equal((html.match(/<tr(?: |>)/g)||[]).length,7);assert.equal(plain.split('\n').length,7);
 assert.deepEqual(plain.split('\n')[0].split('\t'),['Área','PD','Edad equivalente']);assert.doesNotMatch(html,/FULL motora_fina|<script|class=/);assert.doesNotMatch(plain+html,/undefined|null|\[object Object\]/);
 for(const line of plain.split('\n').slice(1)){for(const cell of line.split('\t'))assert.ok(html.includes(cell));}
});
test('HTML copiado consume tipos del modelo e indenta componentes PIAT',()=>{
 const view=createResultPresentation(base,{formatId:'piat'}),html=serializeResultTableHtml(view);
 assert.equal((html.match(/data-row-type="component"/g)||[]).length,4);assert.match(html,/data-row-type="component"[^]*padding-left:18px/);
 assert.equal((html.match(/data-row-type="total"/g)||[]).length,5);assert.equal((html.match(/data-row-type="grand-total"/g)||[]).length,1);
});
test('portapapeles escribe HTML y texto a la vez, con alternativa tabulada',async()=>{
 const view=createResultPresentation(base,{formatId:'piat'});let item;
 class Item{constructor(value){this.value=value;}}
 assert.equal(await copyResultTable(view,{clipboard:{write:async value=>{item=value[0].value;}},ClipboardItemCtor:Item}),'formatted');assert.deepEqual(Object.keys(item).sort(),['text/html','text/plain']);
 let fallback='';assert.equal(await copyResultTable(view,{clipboard:{writeText:async value=>{fallback=value;}},ClipboardItemCtor:null}),'text');assert.equal(fallback,serializeResultTable(view));
});
test('PDF respeta filas, columnas y orientación reproducible',()=>{
 const piat=createResultPresentation(base,{formatId:'piat'}),main=createResultPresentation(base,{formatId:'mainAreas'}),complete=createResultPresentation(base,{formatId:'complete'});
 for(const [view,count,box] of [[piat,10,'595.28 841.89'],[main,6,'595.28 841.89'],[complete,30,'841.89 595.28']]){const out=pdf(view);assert.match(out,new RegExp(`/MediaBox \\[0 0 ${box.replace('.','\\.')}\\]`));for(const row of view.rows)assert.match(out,new RegExp(row.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal(view.rows.length,count);}
 assert.equal(createResultPresentation(base,{formatId:'piat',columns:['pd','pc','T']}).orientation,'portrait');
 assert.equal(createResultPresentation(base,{formatId:'piat',columns:['pd','pc','T','CI']}).orientation,'landscape');
});
test('PDF usa el tipo de presentación para el peso de componentes y totales',()=>{
 const output=pdf(createResultPresentation(base,{formatId:'piat'}));
 assert.match(output,/BT \/F1 7\.7 Tf [^\n]+ \(Motora gruesa\) Tj ET/);
 assert.match(output,/BT \/F1 7\.7 Tf [^\n]+ \(Comunicación expresiva\) Tj ET/);
 assert.match(output,/BT \/F2 7\.7 Tf [^\n]+ \(Motora\) Tj ET/);
 assert.match(output,/BT \/F2 7\.7 Tf [^\n]+ \(Battelle total\) Tj ET/);
});
