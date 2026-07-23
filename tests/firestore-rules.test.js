import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const projectId = `battelle-rules-${Date.now()}`;
const AUTHORIZED = 'authorized-user';
const OTHER = 'other-user';

function validAssessment(overrides = {}){
  return {
    id: 'bat-rules-1', schemaVersion: 3, name: 'Caso', birthDate: '2020-01-02', assessmentDate: '2026-01-02',
    manualAgeOverride: false, ageMonths: 72, observedResponses: {}, observations: {}, correctionMetadata: {},
    progress: { observed: 0, total: 341, percent: 0, label: 'Puntuaciones introducidas: 0/341' },
    organizationId: 'neurointegra', createdBy: AUTHORIZED, updatedBy: AUTHORIZED, revision: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    workflowStatus: 'borrador', ...overrides
  };
}

test('reglas Firestore reales con Emulator cuando @firebase/rules-unit-testing está disponible', async (t)=>{
  let testing;
  try { testing = await import('@firebase/rules-unit-testing'); }
  catch { t.skip('@firebase/rules-unit-testing no está instalado en este entorno; no se ejecutan mocks como pruebas reales de reglas.'); return; }
  const { initializeTestEnvironment, assertFails, assertSucceeds } = testing;
  let env;
  try {
    env = await initializeTestEnvironment({ projectId, firestore: { rules } });
  } catch (error) {
    t.skip(`Firebase Emulator no disponible (${error?.message || error}); no se ejecutan mocks como pruebas reales de reglas.`); return;
  }
  t.after(async()=>env.cleanup());
  await env.withSecurityRulesDisabled(async(ctx)=>{
    await ctx.firestore().doc(`authorizedUsers/${AUTHORIZED}`).set({active:true, organizationId:'neurointegra'});
    await ctx.firestore().doc(`authorizedUsers/${OTHER}`).set({active:false, organizationId:'neurointegra'});
  });
  const authed = env.authenticatedContext(AUTHORIZED, { firebase: { sign_in_provider: 'password' } }).firestore();
  const unauth = env.unauthenticatedContext().firestore();
  const anon = env.authenticatedContext('anon', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const other = env.authenticatedContext(OTHER, { firebase: { sign_in_provider: 'password' } }).firestore();
  const doc = authed.doc('organizations/neurointegra/assessments/bat-rules-1');

  await assertFails(unauth.doc('organizations/neurointegra/assessments/bat-rules-1').get());
  await assertFails(anon.doc('organizations/neurointegra/assessments/bat-rules-1').get());
  await assertFails(other.doc('organizations/neurointegra/assessments/bat-rules-1').get());
  await assertSucceeds(authed.doc(`authorizedUsers/${AUTHORIZED}`).get());
  await assertFails(authed.doc(`authorizedUsers/${AUTHORIZED}`).set({active:false, organizationId:'neurointegra'}));
  await assertFails(doc.set(validAssessment({ extra: true })));
  await assertFails(doc.set(validAssessment({ organizationId: 'otra' })));
  await assertFails(doc.set(validAssessment({ createdBy: OTHER })));
  await assertFails(doc.set(validAssessment({ updatedBy: OTHER })));
  await assertFails(doc.set(validAssessment({ revision: 2 })));
  await assertSucceeds(doc.set(validAssessment()));
  await assertSucceeds(doc.get());
  await assertFails(doc.set(validAssessment({ revision: 2, createdAt: new Date('2026-02-01T00:00:00.000Z') })));
  await assertFails(doc.set(validAssessment({ revision: 3 })));
  await assertSucceeds(doc.set(validAssessment({ revision: 2, name: 'Caso actualizado' })));
});

test('firestore.rules contiene validaciones cerradas exigidas', ()=>{
  assert.match(rules,/keys\(\)\.hasOnly\(assessmentFields\(\)\)/);
  assert.match(rules,/request\.resource\.data\.id == assessmentId/);
  assert.match(rules,/request\.resource\.data\.organizationId == 'neurointegra'/);
  assert.match(rules,/request\.resource\.data\.revision == resource\.data\.revision \+ 1/);
  assert.match(rules,/request\.resource\.data\.createdAt == resource\.data\.createdAt/);
  assert.match(rules,/request\.resource\.data\.updatedAt == request\.time/);
});
