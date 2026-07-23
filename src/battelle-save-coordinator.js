export function createSaveCoordinator({saveSnapshot, applySaved, onError=()=>{}, onStatus=()=>{}}){
  let tail=Promise.resolve(); let seq=0; let pendingTimer=null; let dirty=false;
  async function enqueue(snapshot){ const id=++seq; dirty=false; onStatus('Guardando…'); const run=tail.catch(()=>{}).then(async()=>{ try{ const saved=await saveSnapshot(structuredClone(snapshot)); if(id===seq) applySaved(saved); onStatus('Guardado.'); return {ok:true,saved,seq:id}; }catch(error){ if(id===seq) onError(error); onStatus(error?.code==='assessment_conflict'?'Conflicto: cambios externos sin sobrescribir.':'Error al guardar.'); return {ok:false,error,seq:id}; }}); tail=run; return run; }
  function schedule(snapshot, delay=0){ dirty=true; clearTimeout(pendingTimer); pendingTimer=setTimeout(()=>{ pendingTimer=null; enqueue(snapshot); }, delay); }
  async function flush(snapshot){ if(!dirty && !pendingTimer) return {ok:true,skipped:true}; clearTimeout(pendingTimer); pendingTimer=null; return enqueue(snapshot); }
  return {enqueue,schedule,flush,hasPending:()=>Boolean(pendingTimer)||dirty};
}
export async function guardBeforeLeaving({save, onSuccess}){ const result=await save(); if(result?.ok===false || result===false) return false; onSuccess?.(); return true; }
