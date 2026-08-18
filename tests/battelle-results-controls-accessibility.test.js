import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [script,css]=await Promise.all([readFile('script.js','utf8'),readFile('styles.css','utf8')]);

test('el selector usa controles nativos accesibles y protege Área',()=>{
  assert.match(script,/type:'radio'.*result-format-toggle/);
  assert.match(script,/type:'checkbox'.*result-column-toggle/);
  assert.match(script,/disabled:column\.required/);
  assert.match(script,/ariaLabel:`Mostrar columna \$\{column\.label\}`/);
  assert.match(script,/if\(id==='label'\)\{e\.target\.checked=true;return;\}/);
  assert.match(css,/\.selector-option input:focus-visible\+span/);
});

test('el selector fluye en móvil sin cortar opciones',()=>{
  assert.match(css,/\.option-list\{[^}]*flex-wrap:wrap/);
  assert.match(css,/@media\(max-width:520px\)\{\.selector-option\{flex:1 1 auto\}/);
  assert.match(css,/@media\(min-width:900px\).*customizer-groups/);
});

test('la conclusión visible es exactamente el texto enviado al portapapeles',()=>{
  assert.match(script,/id:'descriptiveConclusion'\},conclusion\.text/);
  assert.match(script,/copyText\(state\.resultTableModel\.conclusion\.text,'conclusionCopyStatus'/);
});
