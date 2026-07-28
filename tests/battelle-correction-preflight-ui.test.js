import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [script,html,css]=await Promise.all(['script.js','index.html','styles.css'].map(file=>readFile(file,'utf8')));

test('diálogo nativo es modal, accesible, cancelable con Escape y devuelve el foco',()=>{assert.match(html,/<dialog[^>]+aria-labelledby="preflightTitle"[^>]+aria-describedby="preflightDescription"/);assert.match(script,/dialog\.showModal\(\)/);assert.match(script,/addEventListener\('cancel'/);assert.match(script,/e\.preventDefault\(\);closeCorrectionPreflight\(\)/);assert.match(script,/\$\('correctBtn'\)\?\.focus\(\)/);});
test('cancelar solo cierra el diálogo y no toca evaluación, revisión ni huella',()=>{const body=script.slice(script.indexOf('function closeCorrectionPreflight'),script.indexOf('function confirmPreflight'));assert.match(body,/dialog\.close\(\)/);assert.doesNotMatch(body,/state\.|assessment|revision|fingerprint|scheduleSave|save\(/);});
test('confirmación revalida huella y un doble clic no ejecuta dos correcciones',()=>{assert.match(script,/correctionConfirmationPending\|\|!dialog\.open/);assert.match(script,/fresh\.fingerprint!==dialog\._preflightModel\?\.fingerprint/);assert.match(script,/renderPreflight\(fresh\);return/);assert.match(script,/try\{runUiCorrection\(\);}/);});
test('actualización remota reconstruye el resumen abierto sin respuestas tardías cruzadas',()=>{assert.match(script,/if\(\$\('correctionPreflightDialog'\)\.open\) renderPreflight\(buildCorrectionPreflight\(preflightRunner\(\)\)\)/);assert.match(script,/state\.assessment\?\.id!==id\) return/);});
test('estado bloqueado solo ofrece revisión, y el diseño se adapta a móvil',()=>{assert.match(script,/model\.status==='blocked'\?el\('button'.*preflightReviewBtn/);assert.doesNotMatch(script,/model\.status==='blocked'.{0,120}preflightConfirmBtn/);assert.match(css,/@media\(max-width:520px\).*\.preflight-dialog/s);});
