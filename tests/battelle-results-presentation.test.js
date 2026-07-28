import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatClinicalAge, formatSpanishDate, formatSpanishDateTime } from '../src/battelle-result-table.js';
import { generateBattellePdf } from '../src/battelle-pdf.js';

const row=(i)=>({label:i===29?'PUNTUACIÓN TOTAL BATTELLE':`Subárea española ${i+1}`,type:i===29?'grand-total':'subarea',pd:i,pc:50,z:0,T:50,CI:100,ECN:50,equivalentAge:'60 meses'});
const fixture={columns:['Área / subárea','PD','PC','z','T','CI','ECN','Edad equivalente'],rows:Array.from({length:30},(_,i)=>row(i)),metadata:{name:'Caso Ñandú',display:{birthDate:'01/02/2020',assessmentDate:'03/02/2026',correctedAt:'03/02/2026 14:35',age:'6 años, 0 meses (72 meses)',professional:'profesional.clínico.muy.largo@example.test'}},warnings:[{item:'Atención',message:'Los espacios entre palabras y los caracteres españoles á é í ó ú ü ñ se conservan correctamente.'}]};

test('formatea fechas y edad para el modelo único de presentación',()=>{assert.equal(formatSpanishDate('2026-02-03'),'03/02/2026');assert.equal(formatSpanishDateTime('2026-02-03T14:35:22.123Z'),'03/02/2026 14:35');assert.equal(formatClinicalAge(60),'5 años, 0 meses (60 meses)');});
test('PDF multipágina repite encabezado, pagina y conserva texto clínico',()=>{const pdf=new TextDecoder('latin1').decode(generateBattellePdf(fixture));assert.equal((pdf.match(/Área \/ subárea/g)||[]).length,2);assert.match(pdf,/Página 1 de 2/);assert.match(pdf,/Página 2 de 2/);assert.match(pdf,/espacios entre palabras/);assert.doesNotMatch(pdf,/T\d{2}:\d{2}:\d{2}|\.\d{3}Z|undefined|null|NaN|\[object Object\]/);assert.equal((pdf.match(/Subárea española/g)||[]).length,29);});
test('interfaz usa estado explícito reversible y ancho completo',async()=>{const [script,css]=await Promise.all(['script.js','styles.css'].map(p=>readFile(new URL(`../${p}`,import.meta.url),'utf8')));assert.match(script,/dataset\.viewMode=corrected\?'results':'administration'/);assert.match(script,/Resultados Battelle/);assert.match(css,/#assessmentView\.results-mode \.layout\{grid-template-columns:minmax\(0,1fr\)\}/);assert.match(css,/\.content-panel.*width:100%/);});
