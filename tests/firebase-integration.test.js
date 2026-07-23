import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAssessmentRecord, ASSESSMENTS_KEY } from '../src/battelle-assessment-repository.js';
import { fromFirestoreDocument, toFirestorePayload, createFirestoreAssessmentRepository, ASSESSMENTS_PATH } from '../src/battelle-firestore-repository.js';
import { detectLocalAssessments, importLocalAssessments } from '../src/battelle-local-import.js';
import { AUTH_ERROR, friendlyAuthError } from '../src/battelle-auth.js';

class Mem{constructor(){this.m=new Map}getItem(k){return this.m.get(k)??null}setItem(k,v){this.m.set(k,v)}removeItem(k){this.m.delete(k)}}
function fakeRepository(existing={}){ const records=new Map(Object.entries(existing)); const calls=[]; return {calls, async getAssessment(id){return records.get(id)||null}, async saveAssessment(record){calls.push(record.id); records.set(record.id,{...record,revision:(record.revision||0)+1}); return records.get(record.id);}}; }
function makeServices(initial={}){
  const store=new Map(Object.entries(initial)); const listeners=[];
  const modules={firestore:{
    collection:(db,...path)=>({path:path.join('/')}), doc:(db,...path)=>({id:path.at(-1), path:path.join('/')}), orderBy:(f,d)=>({f,d}), query:(ref)=>ref,
    serverTimestamp:()=>({toDate:()=>new Date('2026-01-01T00:00:00.000Z')}),
    getDoc:async(ref)=>({exists:()=>store.has(ref.id), id:ref.id, data:()=>store.get(ref.id)}),
    getDocs:async()=>({docs:[...store.entries()].map(([id,data])=>({id,data:()=>data}))}),
    runTransaction:async(db,fn)=>fn({get:async(ref)=>({exists:()=>store.has(ref.id), id:ref.id, data:()=>store.get(ref.id)}), set:(ref,data)=>store.set(ref.id,data), delete:(ref)=>store.delete(ref.id)}),
    onSnapshot:(ref,ok)=>{listeners.push(ok); ok({docs:[...store.entries()].map(([id,data])=>({id,data:()=>data})), metadata:{fromCache:false,hasPendingWrites:false}}); return ()=>{};}
  }};
  return {db:{},modules,store,listeners};
}

test('bloqueo sin autenticación, rechazo anónimo/no autorizado y usuario autorizado', async()=>{
  assert.equal(friendlyAuthError({code:AUTH_ERROR.ANONYMOUS}),'La autenticación anónima no está permitida.');
  assert.equal(friendlyAuthError({code:AUTH_ERROR.UNAUTHORIZED}),'Cuenta no autorizada para Neurointegra.');
  const html=readFileSync(new URL('../index.html', import.meta.url),'utf8');
  assert.match(html,/id="loginView"/); assert.match(html,/Iniciar sesión/); assert.doesNotMatch(html,/Registr/);
  const rules=readFileSync(new URL('../firestore.rules', import.meta.url),'utf8');
  assert.match(rules,/sign_in_provider != 'anonymous'/); assert.match(rules,/authorizedUsers/); assert.match(rules,/allow list, create, update, delete: if false/);
});

test('modelo Firestore sanea documentos y ruta compartida',()=>{
  const rec=createAssessmentRecord({id:'bat-f1',name:'Neuro'});
  const payload=toFirestorePayload(rec,'uid1');
  assert.equal(ASSESSMENTS_PATH,'organizations/neurointegra/assessments');
  assert.equal(payload.organizationId,'neurointegra'); assert.equal(payload.updatedBy,'uid1');
  assert.equal(toFirestorePayload({...rec, observedResponses:{constructor:1}},'uid1'),null);
  assert.equal(fromFirestoreDocument('bat-f1',{...payload, organizationId:'otro'}),null);
});

test('repositorio Firestore incrementa revision, detecta conflicto y elimina con revision', async()=>{
  const rec=createAssessmentRecord({id:'bat-f1'}); const services=makeServices(); const repo=createFirestoreAssessmentRepository({user:{uid:'uid1'}, servicesPromise:services});
  const saved=await repo.saveAssessment(rec,0); assert.equal(saved.revision,1);
  await assert.rejects(repo.saveAssessment({...saved,name:'stale'},0),e=>e.code==='assessment_conflict');
  await repo.deleteAssessment('bat-f1',1); assert.equal(await repo.getAssessment('bat-f1'),null);
});

test('tiempo real notifica cambios remotos sin IndexedDB persistente', async()=>{
  const rec=createAssessmentRecord({id:'bat-f1'}); const services=makeServices({'bat-f1':{...rec,organizationId:'neurointegra',createdBy:'u',updatedBy:'u'}}); const repo=createFirestoreAssessmentRepository({user:{uid:'uid1'}, servicesPromise:services});
  let seen=[]; await repo.subscribeAssessments(rows=>{seen=rows}); assert.equal(seen[0].id,'bat-f1');
  assert.doesNotMatch(readFileSync(new URL('../src/firebase-app.js', import.meta.url),'utf8'),/enableIndexedDbPersistence|persistentLocalCache/);
});

test('error de red no produce estado Guardado en Neurointegra', async()=>{
  const script=readFileSync(new URL('../script.js', import.meta.url),'utf8');
  assert.match(script,/Guardado en Neurointegra/); assert.match(script,/Sin conexión \/ cambios pendientes/); assert.match(script,/onError/);
});

test('conflicto remoto con cambios locales pendientes ofrece recargar o conservar',()=>{
  const html=readFileSync(new URL('../index.html', import.meta.url),'utf8');
  assert.match(html,/Recargar versión guardada/); assert.match(html,/Conservar edición local temporalmente/);
});

test('importación local idempotente, conflicto de ID, corrupta y no borra datos locales', async()=>{
  const s=new Mem; const rec=createAssessmentRecord({id:'bat-i1'}); s.setItem(ASSESSMENTS_KEY,JSON.stringify({schemaVersion:3,revision:1,records:{'bat-i1':rec}}));
  assert.equal(detectLocalAssessments(s).count,1); const repo=fakeRepository(); const result=await importLocalAssessments({repository:repo,storage:s});
  assert.equal(result.imported,1); assert.equal(s.getItem(ASSESSMENTS_KEY).includes('bat-i1'),true);
  const retry=await importLocalAssessments({repository:repo,storage:s}); assert.equal(retry.skipped,1);
  const conflictRepo=fakeRepository({'bat-i1':{...rec,name:'otro'}}); const conflict=await importLocalAssessments({repository:conflictRepo,storage:s}); assert.equal(conflict.conflicts,1);
  const bad=new Mem; bad.setItem(ASSESSMENTS_KEY,'{bad'); const corrupt=await importLocalAssessments({repository:repo,storage:bad}); assert.equal(corrupt.invalid,1);
});

test('cierre de sesión intenta guardar antes de salir',()=>{
  const script=readFileSync(new URL('../script.js', import.meta.url),'utf8');
  assert.match(script,/async function signOutFlow/); assert.match(script,/const result=await flushSave\(\)/); assert.match(script,/perdiendo esos cambios no sincronizados/);
});

test('ausencia de credenciales privadas en código y documentación',()=>{
  for(const file of ['index.html','script.js','docs/firebase-neurointegra.md']){
    const text=readFileSync(new URL(`../${file}`, import.meta.url),'utf8');
    assert.doesNotMatch(text,/[A-Z0-9._%+-]+@neurointegra\.[A-Z]{2,}/i);
    assert.doesNotMatch(text,/contraseña\s*[:=]/i);
  }
});
