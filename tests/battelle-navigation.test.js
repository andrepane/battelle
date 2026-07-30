import test from 'node:test';
import assert from 'node:assert/strict';
import { captureAdministrationNavigation, comparisonControls, resolveAdministrationLocation } from '../src/battelle-navigation.js';

const items=[
  {area:'Cognitiva',subarea:'Discriminación perceptiva'},
  {area:'Cognitiva',subarea:'Memoria'},
  {area:'Cognitiva',subarea:'Razonamiento y habilidades escolares'},
  {area:'Cognitiva',subarea:'Desarrollo conceptual'},
  {area:'Motora',subarea:'Control muscular'}
];

test('la ubicación canónica conserva la primera, tercera y cuarta subárea',()=>{
  for(const subarea of ['Discriminación perceptiva','Razonamiento y habilidades escolares','Desarrollo conceptual']){
    assert.deepEqual(resolveAdministrationLocation({items,areaId:'Cognitiva',subareaId:subarea}),{areaId:'Cognitiva',subareaId:subarea});
  }
});
test('una subárea desaparecida usa la primera válida del área sin índices visuales',()=>{
  assert.deepEqual(resolveAdministrationLocation({items,areaId:'Cognitiva',subareaId:'Eliminada'}),{areaId:'Cognitiva',subareaId:'Discriminación perceptiva'});
});
test('la captura conserva área, ID, desplazamiento y acción de foco',()=>{
  const trigger={classList:{contains:name=>name==='undo-previous-subarea'}};
  assert.deepEqual(captureAdministrationNavigation({areaId:'Cognitiva',subareaId:'Razonamiento y habilidades escolares',trigger,scrollY:840}),{areaId:'Cognitiva',subareaId:'Razonamiento y habilidades escolares',action:'undo',scrollY:840});
});
test('los contextos de comparación exponen controles explícitos',()=>{
  assert.deepEqual(comparisonControls('general'),{backToResults:false,changeSelection:true});
  assert.deepEqual(comparisonControls('reference'),{backToResults:true,changeSelection:false});
});
