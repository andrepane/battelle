import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const projectId = `battelle-rules-${Date.now()}`;
const AUTHORIZED = 'authorized-user';
const OTHER = 'other-user';
const REQUIRED = process.env.FIRESTORE_RULES_REQUIRED === '1';

function isEmulatorUnavailable(error){
  const message = String(error?.message || error || '');
  return /ECONNREFUSED|Failed to connect|emulator.*not.*running|Could not connect|connect ECONNREFUSED/i.test(message);
}

function baseAssessment(overrides = {}){
  return {
    id: 'bat-rules-1',
    schemaVersion: 3,
    name: 'Caso',
    birthDate: '2020-01-02',
    assessmentDate: '2026-01-02',
    manualAgeOverride: false,
    ageMonths: 72,
    observedResponses: {},
    observations: {},
    correctionMetadata: {},
    progress: { observed: 0, total: 341, percent: 0, label: 'Puntuaciones introducidas: 0/341' },
    organizationId: 'neurointegra',
    createdBy: AUTHORIZED,
    updatedBy: AUTHORIZED,
    revision: 1,
    workflowStatus: 'borrador',
    ...overrides
  };
}

function createAssessment({ serverTimestamp, overrides = {} } = {}){
  return baseAssessment({
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides
  });
}

function updateAssessment({ serverTimestamp, createdAt, revision = 2, overrides = {} }){
  return baseAssessment({
    createdAt,
    updatedAt: serverTimestamp(),
    revision,
    name: 'Caso actualizado',
    ...overrides
  });
}

test('reglas Firestore reales con Emulator', async (t)=>{
  let testing;
  let firestore;
  try {
    [testing, firestore] = await Promise.all([
      import('@firebase/rules-unit-testing'),
      import('firebase/firestore')
    ]);
  } catch (error) {
    if(REQUIRED) throw error;
    t.skip(`Dependencias de reglas no instaladas (${error?.message || error}); ejecuta npm install antes de npm run test:firestore-rules.`);
    return;
  }
  const { initializeTestEnvironment, assertFails, assertSucceeds } = testing;
  const { doc, getDoc, setDoc, serverTimestamp, Timestamp } = firestore;
  let env;
  try {
    env = await initializeTestEnvironment({ projectId, firestore: { rules } });
  } catch (error) {
    if(isEmulatorUnavailable(error)) {
      t.skip(`Firebase Emulator no disponible (${error?.message || error}); no se ejecutan mocks como pruebas reales de reglas.`);
      return;
    }
    throw error;
  }
  t.after(async()=>env.cleanup());
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async(ctx)=>{
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, `authorizedUsers/${AUTHORIZED}`), {active:true, organizationId:'neurointegra'});
    await setDoc(doc(adminDb, `authorizedUsers/${OTHER}`), {active:false, organizationId:'neurointegra'});
  });
  const authedDb = env.authenticatedContext(AUTHORIZED, { firebase: { sign_in_provider: 'password' } }).firestore();
  const otherDb = env.authenticatedContext(OTHER, { firebase: { sign_in_provider: 'password' } }).firestore();
  const unauthDb = env.unauthenticatedContext().firestore();
  const anonDb = env.authenticatedContext('anon', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const assessmentRef = doc(authedDb, 'organizations/neurointegra/assessments/bat-rules-1');

  await assertFails(getDoc(doc(unauthDb, 'organizations/neurointegra/assessments/bat-rules-1')));
  await assertFails(getDoc(doc(anonDb, 'organizations/neurointegra/assessments/bat-rules-1')));
  await assertSucceeds(getDoc(doc(authedDb, `authorizedUsers/${AUTHORIZED}`)));
  await assertFails(setDoc(doc(authedDb, `authorizedUsers/${AUTHORIZED}`), {active:false, organizationId:'neurointegra'}));
  await assertFails(setDoc(doc(otherDb, 'organizations/neurointegra/assessments/bat-rules-1'), createAssessment({serverTimestamp})));
  await assertFails(setDoc(assessmentRef, createAssessment({serverTimestamp, overrides:{extra:true}})));
  await assertFails(setDoc(assessmentRef, createAssessment({serverTimestamp, overrides:{organizationId:'otra'}})));
  await assertFails(setDoc(assessmentRef, createAssessment({serverTimestamp, overrides:{createdBy:OTHER}})));
  await assertFails(setDoc(assessmentRef, createAssessment({serverTimestamp, overrides:{updatedBy:OTHER}})));
  await assertFails(setDoc(assessmentRef, createAssessment({serverTimestamp, overrides:{revision:2}})));
  await assertFails(setDoc(assessmentRef, baseAssessment({createdAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z')), updatedAt: Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z'))})));

  await assertSucceeds(setDoc(assessmentRef, createAssessment({serverTimestamp})));
  const stored = await getDoc(assessmentRef);
  assert.equal(stored.exists(), true);
  const storedCreatedAt = stored.data().createdAt;

  await assertFails(setDoc(assessmentRef, updateAssessment({serverTimestamp, createdAt: Timestamp.fromDate(new Date('2026-02-01T00:00:00.000Z'))})));
  await assertFails(setDoc(assessmentRef, updateAssessment({serverTimestamp, createdAt: storedCreatedAt, revision: 3})));
  await assertFails(setDoc(assessmentRef, updateAssessment({serverTimestamp, createdAt: storedCreatedAt, overrides:{updatedAt: Timestamp.fromDate(new Date('2026-03-01T00:00:00.000Z'))}})));
  await assertSucceeds(setDoc(assessmentRef, updateAssessment({serverTimestamp, createdAt: storedCreatedAt, revision: 2})));
});

test('firestore.rules contiene validaciones cerradas exigidas', ()=>{
  assert.match(rules,/keys\(\)\.hasOnly\(assessmentFields\(\)\)/);
  assert.match(rules,/request\.resource\.data\.id == assessmentId/);
  assert.match(rules,/request\.resource\.data\.organizationId == 'neurointegra'/);
  assert.match(rules,/request\.resource\.data\.revision == resource\.data\.revision \+ 1/);
  assert.match(rules,/request\.resource\.data\.createdAt == resource\.data\.createdAt/);
  assert.match(rules,/request\.resource\.data\.updatedAt == request\.time/);
});
