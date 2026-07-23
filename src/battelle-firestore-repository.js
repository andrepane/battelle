import { COLLECTION_ERROR, SCHEMA_VERSION, createAssessmentRecord, sanitizeRecord } from './battelle-assessment-repository.js';
import { getFirebaseServices } from './firebase-app.js';
export const ORGANIZATION_ID='neurointegra';
export const ASSESSMENTS_PATH=`organizations/${ORGANIZATION_ID}/assessments`;
export const FIRESTORE_ERROR=Object.freeze({INVALID:'firestore_document_invalid',UNSYNCED:'firestore_not_confirmed'});
const FORBIDDEN=new Set(['__proto__','constructor','prototype']);
function hasDangerousKeys(value, seen=new WeakSet()){
  if(!value || typeof value!=='object') return false;
  if(seen.has(value)) return false; seen.add(value);
  return Object.keys(value).some(k=>FORBIDDEN.has(k)||hasDangerousKeys(value[k],seen));
}
function timestampToIso(value){ if(typeof value==='string') return value; if(value?.toDate) return value.toDate().toISOString(); if(value instanceof Date) return value.toISOString(); return new Date().toISOString(); }
export function fromFirestoreDocument(id,data){
  if(!data || hasDangerousKeys(data) || data.organizationId!==ORGANIZATION_ID) return null;
  const record=sanitizeRecord({...data,id:data.id||id,createdAt:timestampToIso(data.createdAt),updatedAt:timestampToIso(data.updatedAt)});
  return record ? {...record, organizationId:ORGANIZATION_ID, createdBy:String(data.createdBy||''), updatedBy:String(data.updatedBy||'')} : null;
}
export function toFirestorePayload(record, uid){
  if(hasDangerousKeys(record)) return null;
  const clean=sanitizeRecord(createAssessmentRecord(record));
  if(!clean) return null;
  return {...clean, organizationId:ORGANIZATION_ID, updatedBy:uid};
}
export function createFirestoreAssessmentRepository({user, servicesPromise=getFirebaseServices()}={}){
  if(!user?.uid) throw new Error('Se requiere usuario autenticado para Firestore.');
  const uid=user.uid;
  const ready=Promise.resolve(servicesPromise);
  const col=async()=>{ const {db,modules}=await ready; return {db,modules, ref:modules.firestore.collection(db,'organizations',ORGANIZATION_ID,'assessments')}; };
  async function docRef(id){ const {db,modules}=await ready; return modules.firestore.doc(db,'organizations',ORGANIZATION_ID,'assessments',id); }
  function invalid(){ const e=new Error('Documento de evaluación inválido.'); e.code=FIRESTORE_ERROR.INVALID; return e; }
  return {
    async listAssessments(){ const {modules,ref}=await col(); const q=modules.firestore.query(ref, modules.firestore.orderBy('updatedAt','desc')); const snap=await modules.firestore.getDocs(q); return snap.docs.map(d=>fromFirestoreDocument(d.id,d.data())).filter(Boolean); },
    async getAssessment(id){ const {modules}=await ready; const snap=await modules.firestore.getDoc(await docRef(id)); return snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null; },
    async saveAssessment(record, expectedRevision){ const {modules}=await ready; const ref=await docRef(record.id); const payload=toFirestorePayload(record,uid); if(!payload) throw invalid(); return modules.firestore.runTransaction((await ready).db, async(tx)=>{ const snap=await tx.get(ref); const current=snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null; if(snap.exists()&&!current) throw invalid(); if(current && Number.isInteger(expectedRevision) && current.revision!==expectedRevision){ const e=new Error('La evaluación fue modificada en otro dispositivo.'); e.code=COLLECTION_ERROR.CONFLICT; e.current=current; throw e; } const createdAt=current?.createdAt || payload.createdAt; const revision=(current?.revision||0)+1; const saved={...payload,createdAt,updatedAt:new Date().toISOString(),revision,createdBy:current?.createdBy||uid,updatedBy:uid}; tx.set(ref,{...saved,createdAt:current? snap.data().createdAt : modules.firestore.serverTimestamp(),updatedAt:modules.firestore.serverTimestamp()}); return saved; }); },
    async deleteAssessment(id, expectedRevision){ const {modules}=await ready; const ref=await docRef(id); return modules.firestore.runTransaction((await ready).db, async(tx)=>{ const snap=await tx.get(ref); if(!snap.exists()) return; const current=fromFirestoreDocument(snap.id,snap.data()); if(!current) throw invalid(); if(Number.isInteger(expectedRevision)&&current.revision!==expectedRevision){ const e=new Error('La evaluación fue modificada antes de eliminar.'); e.code=COLLECTION_ERROR.CONFLICT; e.current=current; throw e; } tx.delete(ref); }); },
    async subscribeAssessments(callback){ const {modules,ref}=await col(); const q=modules.firestore.query(ref, modules.firestore.orderBy('updatedAt','desc')); return modules.firestore.onSnapshot(q, snap=>callback(snap.docs.map(d=>fromFirestoreDocument(d.id,d.data())).filter(Boolean), {fromCache:snap.metadata.fromCache, hasPendingWrites:snap.metadata.hasPendingWrites}), error=>callback(null,{error})); },
    async subscribeAssessment(id, callback){ const {modules}=await ready; return modules.firestore.onSnapshot(await docRef(id), snap=>callback(snap.exists()?fromFirestoreDocument(snap.id,snap.data()):null,{fromCache:snap.metadata.fromCache,hasPendingWrites:snap.metadata.hasPendingWrites}), error=>callback(null,{error})); }
  };
}
