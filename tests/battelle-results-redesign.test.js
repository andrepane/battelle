import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildNormalizedResultRow, buildResultTableModel, NOT_APPLICABLE, RESULT_COLUMNS, resultRowOrder } from '../src/battelle-result-table.js';
import { generateBattellePdf, safePdfFilename } from '../src/battelle-pdf.js';
import { lookupEquivalentAge } from '../src/battelle-conversions.js';
const j=async p=>JSON.parse(await readFile(new URL(`../${p}`,import.meta.url),'utf8'));
const model=await j('data/modelo_escalas_battelle.json');
const pcGeneral=await j('data/conversion_pc_general.json');
const equivalentAges=await j('data/edades_equivalentes.json');
const normativeData={pcGeneral,equivalentAges};
test('tabla clínica tiene columnas y orden exactos del modelo',()=>{
 assert.deepEqual(RESULT_COLUMNS,['Área / subárea','PD','PC','z','T','CI','ECN','Edad equivalente']);
 assert.equal(resultRowOrder().length,30); assert.equal(resultRowOrder()[0],'personal_social_interaccion_con_el_adulto');assert.equal(resultRowOrder().at(-1),'battelle_total');
 for(const id of resultRowOrder()) assert.ok(model.subareas[id]||model.escalas[id],id);
});

test('edades equivalentes usan exclusivamente su fuente validada',()=>{
 const expected={motora_gruesa:'N-58',motora_fina:'N-59',motora_total:'N-60',comunicacion_receptiva:'N-61',comunicacion_expresiva:'N-62',comunicacion_total:'N-63',cognitiva_total:'N-64',battelle_total:'N-65'};
 for(const [scaleId,table] of Object.entries(expected)){
  const records=equivalentAges.registros.filter(r=>r.escala_id===scaleId); assert.ok(records.length,scaleId); assert.deepEqual([...new Set(records.map(r=>r.tabla))],[table]);
  const sample=records.find(r=>Number.isInteger(r.pd_min)); const got=lookupEquivalentAge({scaleId,directScore:sample.pd_min,normativeData}); assert.equal(got.ok,true); assert.equal(got.table,table);
  for(const other of Object.keys(expected).filter(id=>id!==scaleId)) assert.notEqual(got.scaleId,other);
 }
 const fine=lookupEquivalentAge({scaleId:'motora_fina',directScore:38,normativeData}); assert.equal(fine.ok,true); assert.equal(fine.text,'34');
 const fineRow=buildNormalizedResultRow({id:'motora_fina',source:{pd:38,equivalentAge:fine},model,results:{},normativeData}); assert.equal(fineRow.equivalentAge,'34');
});

test('Motora fina comparte exactamente la edad equivalente entre tabla web y PDF',()=>{
 const fine=lookupEquivalentAge({scaleId:'motora_fina',directScore:38,normativeData});
 const source=id=>({pd:id==='motora_fina'?38:1,percentile:null,equivalentAge:id==='motora_fina'?fine:null});
 const results={metadata:{name:'Caso motor',birthDate:'2020-01-01',assessmentDate:'2026-01-01'},summary:{ageMonths:72},subareas:Object.fromEntries(Object.keys(model.subareas).map(id=>[id,source(id)])),scales:Object.fromEntries(Object.keys(model.escalas).map(id=>[id,source(id)])),warnings:[]};
 const table=buildResultTableModel({results,model,normativeData}); const row=table.rows.find(r=>r.id==='motora_fina');
 assert.equal(row.equivalentAge,'34'); assert.equal(row.provenance.equivalentAge.table,'N-59');
 const pdf=new TextDecoder('latin1').decode(generateBattellePdf(table)); assert.match(pdf,/PUNTUACIÓN MOTORA FINA/); assert.match(pdf,/\(34\) Tj/);
});
test('Comunicación receptiva y expresiva toman la edad equivalente de sus escalas',()=>{
 const ids=['comunicacion_receptiva','comunicacion_expresiva'];
 const scales=Object.fromEntries(ids.map((id,index)=>{const record=equivalentAges.registros.find(r=>r.escala_id===id);return [id,{pd:record.pd_min,equivalentAge:lookupEquivalentAge({scaleId:id,directScore:record.pd_min,normativeData})}]}));
 const subareas=Object.fromEntries(ids.map(id=>[id,{pd:999,percentile:null}]));
 const results={metadata:{},summary:{ageMonths:24},subareas,scales,warnings:[]};
 const table=buildResultTableModel({results,model,normativeData});
 for(const [index,id] of ids.entries()){const row=table.rows.find(candidate=>candidate.id===id);assert.equal(row.pd,scales[id].pd);assert.equal(row.equivalentAge,scales[id].equivalentAge.text);assert.equal(row.provenance.equivalentAge.table,`N-${61+index}`);}
});
test('fila normalizada encadena PC a N-1 exactamente y conserva procedencia',()=>{
 const row=buildNormalizedResultRow({id:'adaptativa_total',source:{pd:42,percentile:{ok:true,percentile:50,table:'N-10',provenance:'test'},equivalentAge:{ok:false}},model,results:{},normativeData});
 assert.deepEqual([row.pd,row.pc,row.z,row.T,row.CI,row.ECN],[42,50,0,50,100,50]); assert.equal(row.pcKind,'percentil');assert.equal(row.provenance.conversion.table,'N-1');
});
test('la procedencia normativa se conserva internamente aunque no se renderice',()=>{
 const source={pd:42,percentile:{ok:true,percentile:50,table:'N-10',provenance:{archivo:'baremos.xlsx',hoja:'N-10',celda:'B7'}},equivalentAge:{ok:false}};
 const results={metadata:{},summary:{ageMonths:24},subareas:{},scales:{adaptativa_total:source},warnings:[],normative:{version:'baremos-json-v1',id:'normativa-auditada',dataVersion:'items-v1',modelVersion:'model-v1'}};
 const table=buildResultTableModel({results,model,normativeData}); const row=table.rows.find(candidate=>candidate.id==='adaptativa_total');
 assert.deepEqual(row.provenance.pc.provenance,source.percentile.provenance); assert.equal(row.provenance.pc.table,'N-10');
 assert.deepEqual(results.normative,{version:'baremos-json-v1',id:'normativa-auditada',dataVersion:'items-v1',modelVersion:'model-v1'});
});
test('ausencias nunca producen cero ni valores técnicos y edad equivalente solo si existe',()=>{
 const row=buildNormalizedResultRow({id:'adaptativa_atencion',source:{pd:null},model,results:{},normativeData});
 assert.deepEqual([row.pd,row.pc,row.z,row.T,row.CI,row.ECN,row.equivalentAge],Array(7).fill(NOT_APPLICABLE));assert.doesNotMatch(JSON.stringify(row),/undefined|NaN|\[object Object\]/);
});
test('modelo único alimenta PDF, incluye filas y omite detalles técnicos',()=>{
 const source=id=>({pd:1,percentile:{ok:true,percentile:50},equivalentAge:null}); const results={metadata:{name:'Caso Ñ',birthDate:'2020-01-01',assessmentDate:'2026-01-01'},summary:{ageMonths:72},subareas:Object.fromEntries(Object.keys(model.subareas).map(id=>[id,source(id)])),scales:Object.fromEntries(Object.keys(model.escalas).map(id=>[id,source(id)])),totalCentile:{ok:true,centile:50},warnings:[]};
 const table=buildResultTableModel({results,model,normativeData,professional:'profesional@example.test'}); const bytes=generateBattellePdf(table); const text=new TextDecoder('latin1').decode(bytes);assert.equal(table.rows.length,30);assert.match(text,/%PDF-1.4/);assert.match(text,/Resumen de resultados Battelle/);assert.doesNotMatch(text,/Detalles técnicos|Firebase|UID/);assert.equal(safePdfFilename('José / Ñ','2026-01-01'),'Battelle_Jose_N_2026-01-01.pdf');
});
test('la interfaz expone controles, tabla accesible y papelera',async()=>{const [script,html,css]=await Promise.all(['script.js','index.html','styles.css'].map(p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')));assert.match(script,/Editar puntuaciones/);assert.match(script,/Descargar PDF/);assert.match(script,/Conversión no aplicable para esta escala/);assert.match(html,/Papelera/);assert.match(css,/position:sticky/);});
