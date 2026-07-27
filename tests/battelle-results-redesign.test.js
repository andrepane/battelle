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
 const expected={motora_gruesa:'N-58',motora_total:'N-59',comunicacion_receptiva:'N-60',comunicacion_expresiva:'N-61',comunicacion_total:'N-62',cognitiva_total:'N-63',battelle_total:'N-65'};
 assert.equal(equivalentAges.registros.some(r=>r.tabla==='N-64'),false);
 assert.equal(equivalentAges.registros.some(r=>r.escala_id==='motora_fina'),false);
 for(const [scaleId,table] of Object.entries(expected)){
  const records=equivalentAges.registros.filter(r=>r.escala_id===scaleId); assert.ok(records.length,scaleId); assert.deepEqual([...new Set(records.map(r=>r.tabla))],[table]);
  const sample=records.find(r=>Number.isInteger(r.pd_min)); const got=lookupEquivalentAge({scaleId,directScore:sample.pd_min,normativeData}); assert.equal(got.ok,true); assert.equal(got.table,table);
  for(const other of Object.keys(expected).filter(id=>id!==scaleId)) assert.notEqual(got.scaleId,other);
 }
 const fine=lookupEquivalentAge({scaleId:'motora_fina',directScore:1,normativeData}); assert.equal(fine.ok,false); assert.equal(fine.error.code,'escala_no_incluida');
 const fineRow=buildNormalizedResultRow({id:'motora_fina',source:{pd:1,equivalentAge:fine},model,results:{},normativeData}); assert.equal(fineRow.equivalentAge,NOT_APPLICABLE);
});
test('fila normalizada encadena PC a N-1 exactamente y conserva procedencia',()=>{
 const row=buildNormalizedResultRow({id:'adaptativa_total',source:{pd:42,percentile:{ok:true,percentile:50,table:'N-10',provenance:'test'},equivalentAge:{ok:false}},model,results:{},normativeData});
 assert.deepEqual([row.pd,row.pc,row.z,row.T,row.CI,row.ECN],[42,50,0,50,100,50]); assert.equal(row.pcKind,'percentil');assert.equal(row.provenance.conversion.table,'N-1');
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
