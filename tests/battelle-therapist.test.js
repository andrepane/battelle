import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssessmentRecord, filterAssessments, saveAssessment, getAssessment, deleteAssessment, restoreAssessment } from '../src/battelle-assessment-repository.js';
import { canonicalTherapistName, normalizeForComparison, sanitizeTherapistName, therapistLabel, therapistSuggestions } from '../src/battelle-therapist.js';
import { createCorrectionFingerprint } from '../src/battelle-correction.js';
import { buildResultTableModel } from '../src/battelle-result-table.js';
import { generateBattellePdf } from '../src/battelle-pdf.js';
import { readFile } from 'node:fs/promises';

class MemoryStorage { constructor(){this.data=new Map();} getItem(k){return this.data.get(k)??null;} setItem(k,v){this.data.set(k,String(v));} removeItem(k){this.data.delete(k);} }
const record=(id,name,therapistName)=>createAssessmentRecord({id,name,therapistName,birthDate:'2020-01-01',assessmentDate:'2026-01-01',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z'});

test('normaliza espacios, rechaza entradas inválidas y compara sin mayúsculas ni acentos',()=>{
 assert.equal(sanitizeTherapistName('  Andrea   Panepinto  '),'Andrea Panepinto');
 for(const invalid of ['', '   ', '<b>Andrea</b>', {}, [], 4, 'a'.repeat(101)]) assert.equal(sanitizeTherapistName(invalid),null);
 assert.equal(normalizeForComparison(' ÁNDREA   Núñez '),'andrea nunez');
 assert.equal(therapistLabel(null),'Sin asignar');
});

test('sugerencias deduplican y reutilizan la primera grafía canónica existente',()=>{
 const records=[record('bat-one','P1','Andrea Panepinto'),record('bat-two','P2','ANDREA   PANEPINTO'),record('bat-three','P3','Ángela Núñez')];
 assert.deepEqual(therapistSuggestions(records),['Andrea Panepinto','Ángela Núñez']);
 assert.equal(canonicalTherapistName(' andrea  panepinto ',records),'Andrea Panepinto');
});

test('documento antiguo obtiene null; guardar, papelera y restaurar conservan terapeuta aisladamente',async()=>{
 const storage=new MemoryStorage(); const legacy=record('bat-old','Antiguo',undefined); assert.equal(legacy.therapistName,null);
 const first=await saveAssessment(record('bat-one','Paciente Uno','Andrea'),storage,{now:()=> '2026-01-02T00:00:00.000Z'});
 await saveAssessment(record('bat-two','Paciente Dos','Beatriz'),storage,{now:()=> '2026-01-02T00:00:00.000Z'});
 const edited=await saveAssessment({...first,therapistName:'Andrea Ruiz'},storage,{expectedRevision:first.revision,now:()=> '2026-01-03T00:00:00.000Z'});
 assert.equal((await getAssessment('bat-two',storage)).therapistName,'Beatriz');
 const trashed=await deleteAssessment(edited.id,storage,{expectedRevision:edited.revision,now:()=> '2026-01-04T00:00:00.000Z'});
 const restored=await restoreAssessment(edited.id,storage,{expectedRevision:trashed.revision,now:()=> '2026-01-05T00:00:00.000Z'});
 assert.equal(restored.therapistName,'Andrea Ruiz');
});

test('búsqueda y filtro combinan paciente, terapeuta, estado y sin asignar',()=>{
 const rows=[record('bat-one','José Pérez','Ángela Núñez'),record('bat-two','Andrea Paciente',null),record('bat-three','Otro','Beatriz')];
 assert.deepEqual(filterAssessments(rows,{query:'angela nunez'}).map(x=>x.id),['bat-one']);
 assert.deepEqual(filterAssessments(rows,{query:'jose',therapist:'angela nunez'}).map(x=>x.id),['bat-one']);
 assert.deepEqual(filterAssessments(rows,{therapist:'unassigned'}).map(x=>x.id),['bat-two']);
});

test('editar terapeuta no cambia huella ni datos clínicos y resultados/PDF no usan correo compartido',()=>{
 const assessment=record('bat-one','Caso','Andrea Panepinto'); assessment.observedResponses={PS1:2};
 const before=JSON.stringify(assessment.observedResponses), fingerprint=createCorrectionFingerprint({assessment}); assessment.therapistName='Beatriz Ruiz';
 assert.equal(createCorrectionFingerprint({assessment}),fingerprint); assert.equal(JSON.stringify(assessment.observedResponses),before);
 const results={metadata:{name:'Caso',birthDate:'2020-01-01',assessmentDate:'2026-01-01'},summary:{ageMonths:72,correctedAt:'2026-01-01T00:00:00Z'},scales:{},subareas:{},warnings:[]};
 const model=buildResultTableModel({results,model:{escalas:{},subareas:{}},normativeData:{},therapistName:assessment.therapistName});
 assert.equal(model.metadata.display.therapistName,'Beatriz Ruiz'); const pdf=new TextDecoder('latin1').decode(generateBattellePdf(model)); assert.match(pdf,/Terapeuta/); assert.match(pdf,/Beatriz Ruiz/); assert.doesNotMatch(pdf,/firebase|@/i);
});

test('contrato accesible incluye creación, filtro, columna y vista móvil',async()=>{
 const [html,script,css]=await Promise.all(['index.html','script.js','styles.css'].map(p=>readFile(p,'utf8')));
 assert.match(html,/Terapeuta responsable/); assert.match(html,/list="therapistSuggestions"/); assert.match(html,/placeholder="NH, paciente o terapeuta"/); assert.match(html,/id="therapistFilter"/);
 assert.match(script,/\['NH','Paciente','Terapeuta'/); assert.match(script,/therapistName.*focus/); assert.match(script,/Indica el terapeuta responsable/); assert.match(css,/@media\(max-width:800px\)/); assert.match(css,/data-label/);
});
