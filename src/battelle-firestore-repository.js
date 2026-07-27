import { COLLECTION_ERROR, SCHEMA_VERSION, createAssessmentRecord, sanitizeRecord } from './battelle-assessment-repository.js';
import { getFirebaseServices } from './firebase-app.js';
export const ORGANIZATION_ID='neurointegra';
export const ASSESSMENTS_PATH=`organizations/${ORGANIZATION_ID}/assessments`;
export const FIRESTORE_ERROR=Object.freeze({INVALID:'firestore_document_invalid',UNSYNCED:'firestore_not_confirmed',DELETED:'assessment_deleted'});
function invalid(){ const e=new Error('Documento de evaluación inválido.'); e.code=FIRESTORE_ERROR.INVALID; return e; }
function deleted(){ const e=new Error('La evaluación fue eliminada desde otro dispositivo.'); e.code=FIRESTORE_ERROR.DELETED; return e; }
const FORBIDDEN=new Set(['__proto__','constructor','prototype']);
function hasDangerousKeys(value, seen=new WeakSet()){
  if(!value || typeof value!=='object') return false;
  if(seen.has(value)) return false; seen.add(value);
  return Object.keys(value).some(k=>FORBIDDEN.has(k)||hasDangerousKeys(value[k],seen));
}
function timestampToIso(value){ if(typeof value==='string') return value; if(value?.toDate) return value.toDate().toISOString(); if(value instanceof Date) return value.toISOString(); return new Date().toISOString(); }
export function fromFirestoreDocument(id,data){
  if(!data || hasDangerousKeys(data) || data.id!==id || data.organizationId!==ORGANIZATION_ID || data.schemaVersion!==SCHEMA_VERSION || !Number.isInteger(data.revision) || data.revision<1) return null;
  if(typeof data.createdBy!=='string' || !data.createdBy || typeof data.updatedBy!=='string' || !data.updatedBy) return null;
  const record=sanitizeRecord({...data,id,createdAt:timestampToIso(data.createdAt),updatedAt:timestampToIso(data.updatedAt),deletedAt:data.deletedAt==null?null:timestampToIso(data.deletedAt)});
  return record ? {...record, organizationId:ORGANIZATION_ID, createdBy:data.createdBy, updatedBy:data.updatedBy} : null;
}
export function toFirestorePayload(record, uid){
  if(!uid || hasDangerousKeys(record)) return null;
  const clean=sanitizeRecord(createAssessmentRecord(record));
  if(!clean || record.id!==clean.id) return null;
  if(record.organizationId && record.organizationId!==ORGANIZATION_ID) return null;
  if(record.schemaVersion && record.schemaVersion!==SCHEMA_VERSION) return null;
  return {...clean, organizationId:ORGANIZATION_ID};
}
export function createFirestoreAssessmentRepository({user, servicesPromise=getFirebaseServices()}={}){
  if(!user?.uid) throw new Error('Se requiere usuario autenticado para Firestore.');
  const uid=user.uid;
  const ready=Promise.resolve(servicesPromise);
  const col=async()=>{ const {db,modules}=await ready; return {db,modules, ref:modules.firestore.collection(db,'organizations',ORGANIZATION_ID,'assessments')}; };
  async function docRef(id){ const {db,modules}=await ready; return modules.firestore.doc(db,'organizations',ORGANIZATION_ID,'assessments',id); }
  return {
    async listDeletedAssessments(){ const {modules,ref}=await col(); const snap=await modules.firestore.getDocs(modules.firestore.query(ref,modules.firestore.orderBy('updatedAt','desc'))); return snap.docs.map(d=>fromFirestoreDocument(d.id,d.data())).filter(r=>r?.deletedAt); },
    async listAssessments(){ const {modules,ref}=await col(); const q=modules.firestore.query(ref, modules.firestore.orderBy('updatedAt','desc')); const snap=await modules.firestore.getDocs(q); return snap.docs.map(d=>fromFirestoreDocument(d.id,d.data())).filter(r=>r&&!r.deletedAt); },
    async getAssessment(id){ const {modules}=await ready; const snap=await modules.firestore.getDoc(await docRef(id)); return snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null; },
    async saveAssessment(record, expectedRevision){ const {db,modules}=await ready; const ref=await docRef(record.id); if(ref.id!==record.id) throw invalid(); const payload=toFirestorePayload(record,uid); if(!payload) throw invalid(); return modules.firestore.runTransaction(db, async(tx)=>{ const snap=await tx.get(ref); const current=snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null; if(snap.exists()&&!current) throw invalid(); if(current?.deletedAt) throw deleted(); if(!current && Number.isInteger(expectedRevision) && expectedRevision>0) throw deleted(); if(current && Number.isInteger(expectedRevision) && current.revision!==expectedRevision){ const e=new Error('La evaluación fue modificada en otro dispositivo.'); e.code=COLLECTION_ERROR.CONFLICT; e.current=current; throw e; } const revision=(current?.revision||0)+1; const saved={...payload,id:ref.id,createdAt:current?.createdAt||payload.createdAt,updatedAt:new Date().toISOString(),revision,createdBy:current?.createdBy||uid,updatedBy:uid}; const firestorePayload={...saved,createdAt:current?snap.data().createdAt:modules.firestore.serverTimestamp(),updatedAt:modules.firestore.serverTimestamp()}; tx.set(ref,firestorePayload); return saved; }); },
    async deleteAssessment(id,expectedRevision){ const {db,modules}=await ready,ref=await docRef(id); return modules.firestore.runTransaction(db,async tx=>{const snap=await tx.get(ref),current=snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null;if(!current) throw deleted();if(current.deletedAt||current.revision!==expectedRevision){const e=new Error('Conflicto al mover a la papelera.');e.code=COLLECTION_ERROR.CONFLICT;throw e;}const revision=current.revision+1;tx.set(ref,{...snap.data(),deletedAt:modules.firestore.serverTimestamp(),deletedBy:uid,deletionRevision:revision,updatedAt:modules.firestore.serverTimestamp(),updatedBy:uid,revision});return {...current,deletedAt:new Date().toISOString(),deletedBy:uid,deletionRevision:revision,revision};}); },
    async restoreAssessment(id,expectedRevision){const {db,modules}=await ready,ref=await docRef(id);return modules.firestore.runTransaction(db,async tx=>{const snap=await tx.get(ref),current=snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null;if(!current?.deletedAt||current.revision!==expectedRevision){const e=new Error('Conflicto al restaurar.');e.code=COLLECTION_ERROR.CONFLICT;throw e;}const revision=current.revision+1;tx.set(ref,{...snap.data(),deletedAt:null,deletedBy:null,deletionRevision:null,updatedAt:modules.firestore.serverTimestamp(),updatedBy:uid,revision});return {...current,deletedAt:null,deletedBy:null,deletionRevision:null,revision};});},
    async permanentlyDeleteAssessment(id,expectedRevision){const {db,modules}=await ready,ref=await docRef(id);return modules.firestore.runTransaction(db,async tx=>{const snap=await tx.get(ref),current=snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null;if(!current?.deletedAt||current.revision!==expectedRevision){const e=new Error('La eliminación definitiva solo se permite desde la papelera y sin conflictos.');e.code=COLLECTION_ERROR.CONFLICT;throw e;}tx.delete(ref);});},
    async subscribeAssessments(callback){ const {modules,ref}=await col(); const q=modules.firestore.query(ref, modules.firestore.orderBy('updatedAt','desc')); return modules.firestore.onSnapshot(q, snap=>callback(snap.docs.map(d=>fromFirestoreDocument(d.id,d.data())).filter(r=>r&&!r.deletedAt), {fromCache:snap.metadata.fromCache, hasPendingWrites:snap.metadata.hasPendingWrites}), error=>callback(null,{error})); },
    async subscribeAssessment(id, callback){ const {modules}=await ready; return modules.firestore.onSnapshot(await docRef(id), snap=>callback(snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null,{fromCache:snap.metadata.fromCache,hasPendingWrites:snap.metadata.hasPendingWrites}), error=>callback(null,{error})); }
  };
}
