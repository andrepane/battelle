import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAndNormalizeItems } from '../src/battelle-data.js';
import { loadScaleModel } from '../src/battelle-scales.js';
import { scoreAssessment } from '../src/battelle-scoring.js';
import { generateCompleteTestPdf, safeProtocolFilename } from '../src/battelle-protocol-pdf.js';

const items=await loadAndNormalizeItems();
const model=await loadScaleModel();
const observed=Object.fromEntries(items.map((item,index)=>[item.codigo_canonico,index%3]));
const scoring=scoreAssessment(items,model,observed);
const assessment={name:'José Ñandú',therapistName:'Andrea',birthDate:'2020-01-02',assessmentDate:'2026-09-28',ageMonths:80,observedResponses:observed,observations:{[items[0].codigo_canonico]:'Observación clínica conservada íntegramente.'}};

test('PDF completo contiene los 341 ítems una sola vez en un diseño compacto',()=>{
  const pdf=new TextDecoder('latin1').decode(generateCompleteTestPdf({items,assessment,scoring}));
  assert.match(pdf,/%PDF-1.4/);
  assert.match(pdf,/Battelle · Prueba completa/);
  assert.match(pdf,/Observación clínica conservada íntegramente/);
  for(const item of items)assert.equal((pdf.match(new RegExp(`\\(${item.codigo_canonico}\\) Tj`,'g'))||[]).length,1,item.codigo_canonico);
  const pages=Number(/\/Count (\d+)/.exec(pdf)?.[1]);
  assert.ok(pages>=4&&pages<=12,`paginación inesperada: ${pages}`);
  assert.match(pdf,new RegExp(`Página ${pages} de ${pages}`));
});

test('distingue observado, basal, techo y pendiente sin alterar los datos',()=>{
  const tiny=items.slice(0,4);const clinical={respuestas_efectivas:{[tiny[0].codigo_canonico]:{puntuacion:1,origen:'observado'},[tiny[1].codigo_canonico]:{puntuacion:2,origen:'basal'},[tiny[2].codigo_canonico]:{puntuacion:0,origen:'techo'},[tiny[3].codigo_canonico]:{puntuacion:null,origen:null}}};
  const before=structuredClone({tiny,assessment,clinical});
  const pdf=new TextDecoder('latin1').decode(generateCompleteTestPdf({items:tiny,assessment,scoring:clinical}));
  assert.match(pdf,/1 OBS\./);assert.match(pdf,/2 B/);assert.match(pdf,/0 T/);assert.deepEqual({tiny,assessment,clinical},before);
});

test('nombre de archivo seguro y botón con el texto acordado',async()=>{
  assert.equal(safeProtocolFilename('José / Ñ','2026-09-28'),'Battelle_prueba_completa_Jose_N_2026-09-28.pdf');
  const script=await readFile(new URL('../script.js',import.meta.url),'utf8');
  assert.match(script,/PDF de la prueba completa/);
  assert.match(script,/downloadCompleteTestPdf\(\{items:state\.items,assessment:state\.assessment,scoring:state\.score\}\)/);
});
