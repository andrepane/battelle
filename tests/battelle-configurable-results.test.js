import test from 'node:test';
import assert from 'node:assert/strict';
import { RESULT_COLUMN_DEFINITIONS, RESULT_COLUMN_PRESETS, RESULT_FORMATS, createResultPresentation, reviewScoreMessages, selectResultColumns, serializeResultTable } from '../src/battelle-result-table.js';
import { buildDescriptiveSummary, createCorrectionFingerprint } from '../src/battelle-correction.js';
import { generateBattellePdf } from '../src/battelle-pdf.js';

const labels=selection=>selectResultColumns(selection).map(column=>column.label);
const pdfText=(model,selection)=>new TextDecoder('latin1').decode(generateBattellePdf(model,selection));
const row={label:'TOTAL MOTORA',type:'total',pd:12,pc:50,z:0,T:50,CI:100,ECN:50,equivalentAge:'40–41 meses'};
const model={rows:[row],metadata:{name:'Caso',display:{}},warnings:[]};
const eq=(min,max=min)=>({ok:true,minMonths:min,maxMonths:max});
const results=(overrides={})=>({summary:{ageMonths:48},scales:{personal_social_total:{equivalentAge:eq(30)},adaptativa_total:{equivalentAge:eq(35)},motora_total:{equivalentAge:eq(40,41)},comunicacion_total:{equivalentAge:eq(45)},cognitiva_total:{equivalentAge:eq(50)},motora_fina:{equivalentAge:eq(1)},motora_gruesa:{equivalentAge:eq(99)},battelle_total:{equivalentAge:eq(120)},...overrides}});

test('presets y selección personalizada comparten el modelo y mantienen Área/subárea',()=>{
 assert.deepEqual(labels(RESULT_COLUMN_PRESETS.piat),['Área / subárea','PD','Edad equivalente']);
 assert.deepEqual(labels(RESULT_COLUMN_PRESETS.complete),['Área / subárea','PD','PC','z','T','CI','ECN','Edad equivalente']);
 assert.deepEqual(labels(['pc','T']),['Área / subárea','PC','T']);
 assert.deepEqual(labels([]),['Área / subárea']);
 assert.equal(RESULT_COLUMN_DEFINITIONS.find(column=>column.id==='label').required,true);
});
test('los tres formatos y todas las columnas conservan su contrato',()=>{assert.deepEqual(Object.keys(RESULT_FORMATS),['piat','mainAreas','complete']);for(const format of Object.values(RESULT_FORMATS)){const view=createResultPresentation({...model,rows:[{...row,id:'motora_total',canonicalLabel:'Motora'}]},{formatId:format.id,columns:RESULT_COLUMN_DEFINITIONS.map(c=>c.id)});assert.equal(view.format.id,format.id);assert.deepEqual(view.columns.map(c=>c.id),RESULT_COLUMN_DEFINITIONS.map(c=>c.id));}});
test('portapapeles y PDF contienen exclusivamente las mismas columnas seleccionadas',()=>{
 const selection=['pd','equivalentAge']; const copied=serializeResultTable(model,selection);
 assert.equal(copied,'Área / subárea\tPD\tEdad equivalente\nTOTAL MOTORA\t12\t40–41 meses');
 const pdf=pdfText(model,selection); assert.match(pdf,/Área \/ subárea/);assert.match(pdf,/Edad equivalente/);assert.doesNotMatch(pdf,/\(PC\) Tj|\(ECN\) Tj/);
 const full=pdfText(model,RESULT_COLUMN_PRESETS.complete);for(const header of ['PD','PC','z','T','CI','ECN','Edad equivalente'])assert.match(full,new RegExp(`\\(${header}\\) Tj`));
});
test('cambiar columnas no afecta datos clínicos ni huella de corrección',()=>{const assessment={birthDate:'2020-01-01',assessmentDate:'2024-01-01',observedResponses:{A1:2}};const before=JSON.stringify({assessment,row});const fingerprint=createCorrectionFingerprint({assessment});selectResultColumns(['pc']);serializeResultTable(model,['pc']);assert.equal(JSON.stringify({assessment,row}),before);assert.equal(createCorrectionFingerprint({assessment}),fingerprint);});
test('conclusión compara solo cinco totales, conserva intervalos y edad corregida',()=>{const summary=buildDescriptiveSummary({results:results()});assert.equal(summary.ok,true);assert.match(summary.text,/tenía 48 meses/);assert.match(summary.text,/Personal\/Social.*30 meses/);assert.match(summary.text,/Cognitiva.*50 meses/);assert.doesNotMatch(summary.text,/fina|gruesa|Battelle/i);const interval=buildDescriptiveSummary({results:results({personal_social_total:{equivalentAge:eq(20,21)}})});assert.match(interval.text,/20–21 meses/);});
test('conclusión gestiona empates, igualdad, un único valor y ausencia de datos',()=>{const tied=buildDescriptiveSummary({results:results({adaptativa_total:{equivalentAge:eq(30)},comunicacion_total:{equivalentAge:eq(50)}})});assert.match(tied.text,/Personal\/Social y Adaptativa presentan los resultados más bajos/);assert.match(tied.text,/Comunicación y Cognitiva alcanzan los más altos/);const same=buildDescriptiveSummary({results:results({personal_social_total:{equivalentAge:eq(40)},adaptativa_total:{equivalentAge:eq(40)},motora_total:{equivalentAge:eq(40)},comunicacion_total:{equivalentAge:eq(40)},cognitiva_total:{equivalentAge:eq(40)}})});assert.match(same.text,/5 áreas.*misma edad equivalente: 40 meses/);const single=buildDescriptiveSummary({results:{summary:{ageMonths:48},scales:{comunicacion_total:{equivalentAge:eq(36)}}}});assert.equal(single.ok,true);assert.match(single.text,/única área.*Comunicación.*36 meses/);const none=buildDescriptiveSummary({results:{summary:{ageMonths:48},scales:{adaptativa_total:{equivalentAge:{ok:false}}}}});assert.equal(none.ok,false);assert.equal(none.text,'No hay suficientes edades equivalentes válidas para generar la conclusión.');});
test('incidencias basal y techo se traducen sin jerga y se deduplican',()=>{const messages=reviewScoreMessages([{tipo:'discrepancia_basal',codigo:'A32'},{tipo:'discrepancia_basal',codigo:'A32'},{tipo:'inconsistencia_techo',codigo:'A45'},{tipo:'techo_provisional',codigo:'A50'}]);assert.deepEqual(messages.map(w=>w.message),['Revisa A32: tiene una puntuación inferior a 2 antes del basal establecido.','Revisa A45: tiene una puntuación superior a 0 después del techo establecido.']);});
test('PDF usa exactamente la conclusión de pantalla y solo la incluye si es válida',()=>{const conclusion=buildDescriptiveSummary({results:results()});const valid=pdfText({...model,conclusion},RESULT_COLUMN_PRESETS.piat);assert.match(valid,/Conclusión descriptiva/);const rendered=[...valid.matchAll(/\((.*?)\) Tj/g)].map(match=>match[1]).join(' ');assert.ok(rendered.includes(conclusion.text.replaceAll('–','-')));const invalid=pdfText({...model,conclusion:{...conclusion,ok:false}},RESULT_COLUMN_PRESETS.piat);assert.doesNotMatch(invalid,/Conclusión descriptiva/);assert.doesNotMatch(conclusion.text,/retraso|normalidad|alteración|gravedad|diagnóstico|déficit|desarrollo adecuado/i);});
