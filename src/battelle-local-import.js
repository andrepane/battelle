import { ASSESSMENTS_KEY, SCHEMA_VERSION, readCollectionStatus, sanitizeRecord } from './battelle-assessment-repository.js';
export const FIREBASE_IMPORT_MARK_KEY='battelleAssessmentsV3:firebaseImportConfirmed';
export function detectLocalAssessments(storage=localStorage){ const status=readCollectionStatus(storage); return {...status,count:status.ok?Object.keys(status.records).length:0, completed:storage.getItem(FIREBASE_IMPORT_MARK_KEY)==='done'}; }
export async function importLocalAssessments({repository, storage=localStorage}){
  const status=readCollectionStatus(storage); const result={imported:0,skipped:0,invalid:0,conflicts:0,details:[]};
  if(!status.ok){ result.invalid=1; result.error=status.error; return result; }
  for(const [id,rec] of Object.entries(status.records)){
    const clean=sanitizeRecord(rec); if(!clean || clean.id!==id){ result.invalid++; result.details.push({id,status:'invalid'}); continue; }
    const remote=await repository.getAssessment(id);
    if(remote){ const same=['id','schemaVersion','name','birthDate','assessmentDate','manualAgeOverride','ageMonths','observedResponses','observations','workflowStatus','correctionMetadata'].every(k=>JSON.stringify(remote[k])===JSON.stringify(clean[k])); if(same){ result.skipped++; result.details.push({id,status:'skipped'}); } else { result.conflicts++; result.details.push({id,status:'conflict'}); } continue; }
    await repository.saveAssessment(clean, 0); result.imported++; result.details.push({id,status:'imported'});
  }
  if(result.invalid===0 && result.conflicts===0) storage.setItem(FIREBASE_IMPORT_MARK_KEY,'done');
  return result;
}
export function localSchemaDescription(){ return `localStorage.${ASSESSMENTS_KEY} contiene {schemaVersion:${SCHEMA_VERSION}, revision, records:{[id]: evaluación Battelle V3}}; Firestore conserva cada record en organizations/neurointegra/assessments/{assessmentId} y añade organizationId, createdBy y updatedBy.`; }
