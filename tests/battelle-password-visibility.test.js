import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('la contraseña permanece oculta inicialmente y ofrece mostrar u ocultar sin cambiar su valor',async()=>{
  const [html,script,css]=await Promise.all(['index.html','script.js','styles.css'].map(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')));
  assert.match(html,/id="loginPassword" type="password"/);
  assert.match(script,/id:'togglePasswordBtn'/);
  assert.match(script,/password\.type=show\?'text':'password'/);
  assert.match(script,/show\?'Ocultar':'Mostrar'/);
  assert.match(script,/ariaLabel:'Mostrar contraseña'/);
  assert.match(script,/password\.focus\(\)/);
  assert.doesNotMatch(script,/loginPassword[^\n]*(localStorage|sessionStorage)/);
  assert.match(css,/\.password-toggle:focus-visible/);
});
