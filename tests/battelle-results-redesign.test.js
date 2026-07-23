import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { lookupEquivalentAge } from '../src/battelle-conversions.js';

const j=async p=>JSON.parse(await readFile(new URL(`../${p}`,import.meta.url),'utf8'));
const data={equivalentAges:await j('data/edades_equivalentes.json')};

const expectedMappings=[
  ['N-56','personal_social_total'],
  ['N-57','adaptativa_total'],
  ['N-58','motora_gruesa'],
  ['N-59','motora_fina'],
  ['N-60','motora_total'],
  ['N-61','comunicacion_receptiva'],
  ['N-62','comunicacion_expresiva'],
  ['N-63','comunicacion_total'],
  ['N-64','cognitiva_total'],
  ['N-65','battelle_total'],
];

test('mapeos de edad equivalente N-56…N-65 se resuelven con escala_id canónico',()=>{
  for(const [tabla,scaleId] of expectedMappings){
    const rec=data.equivalentAges.registros.find(r=>r.tabla===tabla);
    assert.ok(rec, `${tabla} tiene registros`);
    assert.equal(rec.escala_id, scaleId);
    const got=lookupEquivalentAge({scaleId,directScore:rec.pd_min,normativeData:data});
    assert.equal(got.ok,true, `${tabla} ${scaleId}`);
    assert.equal(got.table,tabla);
    assert.equal(got.scaleId,scaleId);
  }
});

test('N-59 devuelve edad equivalente para motora_fina cuando la PD coincide',()=>{
  const rec=data.equivalentAges.registros.find(r=>r.tabla==='N-59' && r.escala_id==='motora_fina');
  assert.ok(rec);
  const got=lookupEquivalentAge({scaleId:'motora_fina',directScore:rec.pd_min,normativeData:data});
  assert.equal(got.ok,true);
  assert.equal(got.table,'N-59');
  assert.equal(got.text,rec.edad_equivalente_texto);
});

test('presentación de resultados elimina textos técnicos y mantiene estructura de informe',async()=>{
  const script=await readFile(new URL('../script.js',import.meta.url),'utf8');
  const styles=await readFile(new URL('../styles.css',import.meta.url),'utf8');
  assert.match(script,/Resultados de la evaluación/);
  assert.match(script,/Editar puntuaciones/);
  assert.match(script,/Descargar PDF/);
  assert.match(script,/Información técnica y procedencia normativa/);
  assert.match(script,/Puntuación típica z derivada del centil total mediante la tabla N-1\./);
  assert.match(script,/Puntuación T derivada del centil total mediante la tabla N-1\./);
  assert.match(script,/Puntuación CI derivada del centil total mediante la tabla N-1\. No equivale por sí sola a una evaluación del funcionamiento intelectual\./);
  assert.match(script,/Equivalente de la Curva Normal derivado del centil total mediante la tabla N-1\./);
  assert.doesNotMatch(script,/Edad cronológica normativa/);
  assert.match(script,/Los resultados deben interpretarse conjuntamente/);
  assert.match(script,/Personal\/Social.*Adaptativa.*Motora.*Comunicación.*Cognitiva/s);
  assert.match(script,/pdLabel\(s\)/);
  assert.doesNotMatch(script,/Resultados corregidos/);
  assert.doesNotMatch(script,/Estado: válido|Estado: undefined|Reglas disponibles en el cuaderno/);
  assert.doesNotMatch(script,/Síntesis descriptiva automática|meses por debajo|El percentil de/);
  assert.match(styles,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(styles,/@media\(max-width:800px\)/);
});

test('subáreas se agrupan sin duplicar agregados y Battelle total queda fuera de tablas',async()=>{
  const model=await j('data/modelo_escalas_battelle.json');
  assert.equal(Object.keys(model.subareas).length,22);
  const script=await readFile(new URL('../script.js',import.meta.url),'utf8');
  assert.match(script,/aggregateByArea=\{Motora:\['motora_gruesa','motora_fina'\],Comunicación:\['comunicacion_receptiva','comunicacion_expresiva'\]\}/);
  assert.doesNotMatch(script,/battelle_total'\]\)\.map/);
});
