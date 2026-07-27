/** A save queue belongs to exactly one assessment and owns its revision. */
export function createSaveCoordinator({assessmentId, initialRevision=0, saveSnapshot, applySaved, onError=()=>{}, onStatus=()=>{}}){
  let tail=Promise.resolve({ok:true,skipped:true});
  let pendingTimer=null;
  let pendingSnapshot=null;
  let dirty=false;
  let cancelled=false;
  let revision=initialRevision;
  let generation=0;
  let sequence=0;
  let inFlight=0;

  function validSnapshot(snapshot){
    if(!snapshot?.id || (assessmentId && snapshot.id!==assessmentId)) throw new Error('La cola de guardado no pertenece a esta evaluación.');
  }
  function enqueue(snapshot){
    validSnapshot(snapshot);
    if(cancelled) return Promise.resolve({ok:false,cancelled:true});
    const operationGeneration=generation;
    const operationSequence=++sequence;
    const copy=structuredClone(snapshot);
    dirty=true;
    onStatus('Guardando…');
    inFlight++;
    const run=tail.catch(()=>{}).then(async()=>{
      if(cancelled || operationGeneration!==generation) return {ok:false,cancelled:true};
      try{
        const saved=await saveSnapshot(copy,revision);
        if(cancelled || operationGeneration!==generation) return {ok:false,cancelled:true,saved};
        revision=saved.revision;
        if(operationSequence===sequence){ dirty=Boolean(pendingTimer || pendingSnapshot); applySaved(saved); onStatus(dirty?'Guardando…':'Guardado.'); }
        return {ok:true,saved};
      }catch(error){
        if(!cancelled && operationGeneration===generation){ dirty=true; onError(error); onStatus(error?.code==='assessment_conflict'?'Conflicto: cambios externos sin sobrescribir.':'Error al guardar; cambios pendientes.'); }
        return {ok:false,error};
      } finally { inFlight--; }
    });
    tail=run;
    return run;
  }
  function schedule(snapshot,delay=0){
    validSnapshot(snapshot);
    if(cancelled) return;
    dirty=true; pendingSnapshot=structuredClone(snapshot); clearTimeout(pendingTimer);
    pendingTimer=setTimeout(()=>{ const next=pendingSnapshot; pendingSnapshot=null; pendingTimer=null; enqueue(next); },delay);
  }
  async function flush(snapshot){
    if(cancelled) return {ok:false,cancelled:true};
    if(snapshot) validSnapshot(snapshot);
    if(pendingTimer || pendingSnapshot){ clearTimeout(pendingTimer); pendingTimer=null; pendingSnapshot=null; return enqueue(snapshot); }
    if(dirty) return enqueue(snapshot);
    if(inFlight) return tail;
    return {ok:true,skipped:true};
  }
  function cancel(){ cancelled=true; generation++; clearTimeout(pendingTimer); pendingTimer=null; pendingSnapshot=null; dirty=false; }
  return {enqueue,schedule,flush,cancel,hasPending:()=>dirty||Boolean(pendingTimer),assessmentId,getRevision:()=>revision};
}

export async function guardBeforeLeaving({save,onSuccess}){ const result=await save(); if(result?.ok===false || result===false) return false; onSuccess?.(); return true; }
