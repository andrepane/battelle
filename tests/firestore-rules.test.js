import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const projectId = `battelle-rules-${Date.now()}`;
const AUTHORIZED = 'authorized-user';
const OTHER = 'other-user';
const DENIED = 'denied-user';
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
    deletedAt: null,
    deletedBy: null,
    deletionRevision: null,
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
  const { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } = firestore;
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
    await setDoc(doc(adminDb, `authorizedUsers/${OTHER}`), {active:true, organizationId:'neurointegra'});
    await setDoc(doc(adminDb, `authorizedUsers/${DENIED}`), {active:false, organizationId:'neurointegra'});
  });
  const authedDb = env.authenticatedContext(AUTHORIZED, { firebase: { sign_in_provider: 'password' } }).firestore();
  const otherDb = env.authenticatedContext(OTHER, { firebase: { sign_in_provider: 'password' } }).firestore();
  const deniedDb = env.authenticatedContext(DENIED, { firebase: { sign_in_provider: 'password' } }).firestore();
  const unauthDb = env.unauthenticatedContext().firestore();
  const anonDb = env.authenticatedContext('anon', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  const assessmentRef = doc(authedDb, 'organizations/neurointegra/assessments/bat-rules-1');

  await assertFails(getDoc(doc(unauthDb, 'organizations/neurointegra/assessments/bat-rules-1')));
  await assertFails(getDoc(doc(anonDb, 'organizations/neurointegra/assessments/bat-rules-1')));
  await assertSucceeds(getDoc(doc(authedDb, `authorizedUsers/${AUTHORIZED}`)));
  await assertFails(setDoc(doc(authedDb, `authorizedUsers/${AUTHORIZED}`), {active:false, organizationId:'neurointegra'}));
  await assertFails(setDoc(doc(deniedDb, 'organizations/neurointegra/assessments/bat-rules-1'), createAssessment({serverTimestamp})));
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
  const otherAssessmentRef = doc(otherDb, 'organizations/neurointegra/assessments/bat-rules-1');
  await assertFails(setDoc(otherAssessmentRef, updateAssessment({serverTimestamp, createdAt: storedCreatedAt, revision:2, overrides:{createdBy:OTHER,updatedBy:OTHER}})));
  await assertSucceeds(setDoc(otherAssessmentRef, updateAssessment({serverTimestamp, createdAt: storedCreatedAt, revision:2, overrides:{createdBy:AUTHORIZED,updatedBy:OTHER}})));
  const updatedByOther=await getDoc(otherAssessmentRef);
  assert.equal(updatedByOther.data().createdBy,AUTHORIZED);
  assert.equal(updatedByOther.data().updatedBy,OTHER);
  await assertFails(deleteDoc(doc(deniedDb, 'organizations/neurointegra/assessments/bat-rules-1')));
  await assertFails(deleteDoc(otherAssessmentRef)); // activo: borrado físico prohibido
  const active=updatedByOther.data();
  await assertFails(setDoc(otherAssessmentRef,{...active,revision:3,updatedAt:serverTimestamp(),updatedBy:OTHER,deletedAt:Timestamp.fromDate(new Date('2026-01-01')),deletedBy:OTHER,deletionRevision:3}));
  await assertFails(setDoc(doc(deniedDb,'organizations/neurointegra/assessments/bat-rules-1'),{...active,revision:3,updatedAt:serverTimestamp(),updatedBy:DENIED,deletedAt:serverTimestamp(),deletedBy:DENIED,deletionRevision:3}));
  await assertSucceeds(setDoc(otherAssessmentRef,{...active,revision:3,updatedAt:serverTimestamp(),updatedBy:OTHER,deletedAt:serverTimestamp(),deletedBy:OTHER,deletionRevision:3}));
  const trashed=(await getDoc(otherAssessmentRef)).data(); assert.equal(trashed.revision,3);assert.equal(trashed.deletedBy,OTHER);assert.ok(trashed.deletedAt instanceof Timestamp);
  await assertFails(setDoc(otherAssessmentRef,{...trashed,revision:5,updatedAt:serverTimestamp(),updatedBy:OTHER,deletedAt:null,deletedBy:null,deletionRevision:null}));
  await assertSucceeds(setDoc(otherAssessmentRef,{...trashed,revision:4,updatedAt:serverTimestamp(),updatedBy:OTHER,deletedAt:null,deletedBy:null,deletionRevision:null}));
  const restored=(await getDoc(otherAssessmentRef)).data();assert.equal(restored.revision,4);assert.equal(restored.deletedAt,null);
  await assertSucceeds(setDoc(otherAssessmentRef,{...restored,revision:5,updatedAt:serverTimestamp(),updatedBy:OTHER,deletedAt:serverTimestamp(),deletedBy:OTHER,deletionRevision:5}));
  await assertSucceeds(deleteDoc(otherAssessmentRef));

  // Documento heredado sin campos de papelera: sigue siendo legible y se puede actualizar.
  await env.withSecurityRulesDisabled(async ctx=>{const legacy=baseAssessment({id:'legacy-1'});delete legacy.deletedAt;delete legacy.deletedBy;delete legacy.deletionRevision;await setDoc(doc(ctx.firestore(),'organizations/neurointegra/assessments/legacy-1'),{...legacy,createdAt:Timestamp.now(),updatedAt:Timestamp.now()});});
  const legacyRef=doc(authedDb,'organizations/neurointegra/assessments/legacy-1');assert.equal((await getDoc(legacyRef)).exists(),true);
});

test('firestore.rules contiene validaciones cerradas exigidas', ()=>{
  assert.match(rules,/keys\(\)\.hasOnly\(assessmentFields\(\)\)/);
  assert.match(rules,/request\.resource\.data\.id == assessmentId/);
  assert.match(rules,/request\.resource\.data\.organizationId == 'neurointegra'/);
  assert.match(rules,/request\.resource\.data\.revision == resource\.data\.revision \+ 1/);
  assert.match(rules,/request\.resource\.data\.createdAt == resource\.data\.createdAt/);
  assert.match(rules,/request\.resource\.data\.updatedAt == request\.time/);
});

test('reglas exigen papelera antes de borrado físico y campos de servidor',()=>{
  assert.match(rules,/resource\.data\.deletedAt != null/);
  assert.match(rules,/request\.resource\.data\.deletedAt == request\.time/);
  assert.match(rules,/request\.resource\.data\.deletedBy == request\.auth\.uid/);
  assert.match(rules,/deletionRevision == request\.resource\.data\.revision/);
});
