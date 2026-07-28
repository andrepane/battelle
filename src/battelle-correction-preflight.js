function group(entries, fallbackReason){
  const groups=new Map();
  for(const entry of entries){
    const area=entry.area ?? 'Evaluación'; const subarea=entry.subarea ?? 'General'; const key=`${area}|${subarea}`;
    const current=groups.get(key) ?? {area,subarea,count:0,reasons:[],items:[]}; current.count++;
    const reason=entry.reason ?? entry.mensaje ?? entry.message ?? fallbackReason; if(reason&&!current.reasons.includes(reason)) current.reasons.push(reason);
    const code=entry.code ?? entry.codigo; if(code&&!current.items.includes(code)) current.items.push(code); groups.set(key,current);
  }
  return [...groups.values()];
}
export function buildCorrectionPreflight(inspection){
  const scoring=inspection?.scoring; const subareas=Object.values(scoring?.subareas ?? {}); const effective=Object.values(scoring?.respuestas_efectivas ?? {});
  const locate=w=>{ const sub=subareas.find(s=>`${s.area}|${s.subarea}`===w.subarea); return {...w,area:sub?.area,subarea:sub?.subarea ?? w.subarea}; };
  const warnings=group((scoring?.advertencias ?? []).map(locate),'Advertencia clínica.'); const pending=inspection?.pendingReport?.items ?? []; const pendingCodes=new Set(pending.map(item=>item.code));
  const blockers=group([...pending,...(inspection?.errors ?? []).filter(error=>error.type!=='items_pendientes'&&!(error.code&&pendingCodes.has(error.code))),...(inspection?.inconsistencies ?? []).map(error=>({...error,code:error.codigo,reason:error.mensaje}))],'Requiere revisión clínica.');
  const first=blockers.find(item=>item.items.length) ?? blockers[0] ?? null; const status=!inspection?.ok?'blocked':warnings.length?'warnings':'ready';
  return Object.freeze({status,allowed:inspection?.ok===true,counts:{readySubareas:subareas.filter(s=>s.completa).length,totalSubareas:subareas.length||22,observed:effective.filter(r=>r.origen==='observado').length,derivedByBasal:effective.filter(r=>r.origen==='basal').length,derivedByCeiling:effective.filter(r=>r.origen==='techo').length,warnings:(scoring?.advertencias??[]).length,blockers:blockers.reduce((total,item)=>total+item.count,0)},warnings,blockers,firstReviewTarget:first?{area:first.area,subarea:first.subarea,code:first.items[0]??null}:null,fingerprint:inspection?.fingerprint??null});
}
