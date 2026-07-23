import { normalizeItemCode } from './battelle-data.js';
import { SCHEMA_VERSION, calculateAgeMonths } from './battelle-state.js';
import { NORMATIVE_PENDING_MESSAGE, ageBandForMonths, equivalentAgeForScale, percentileForScale } from './battelle-conversions.js';

export const CORRECTION_STATUSES = Object.freeze(['administrando','corrigiendo','corregida','resultado_desactualizado','correccion_bloqueada']);
const MAIN_SCALES = ['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
function stable(value){ if(Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if(value && typeof value==='object'){ return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`; } return JSON.stringify(value); }
export function effectiveAgeMonths(assessment){ if(!assessment) return null; if(assessment.manualAgeOverride) return Number.isInteger(assessment.ageMonths) ? assessment.ageMonths : null; const r=calculateAgeMonths(assessment.birthDate, assessment.assessmentDate); return r.ok ? r.months : null; }
export function createCorrectionFingerprint({ assessment, dataVersion='items-v1', modelVersion='model-v1' }){
  return stable({ schemaVersion: SCHEMA_VERSION, dataVersion, modelVersion, birthDate:assessment?.birthDate ?? '', assessmentDate:assessment?.assessmentDate ?? '', manualAgeOverride:!!assessment?.manualAgeOverride, ageMonths:effectiveAgeMonths(assessment), observedResponses:assessment?.observedResponses ?? {} });
}
export function isCorrectionStale({ assessment, correction, dataVersion, modelVersion }){ return !correction?.fingerprint || correction.fingerprint !== createCorrectionFingerprint({ assessment, dataVersion, modelVersion }); }
export function validateCorrectionPrerequisites({ assessment, items }){
  const errors=[]; const age=effectiveAgeMonths(assessment);
  if(!assessment) errors.push({type:'sin_evaluacion', message:'No existe una evaluación activa.'});
  const dateCheck = assessment ? calculateAgeMonths(assessment.birthDate, assessment.assessmentDate) : {ok:false};
  if(!Number.isInteger(age)) errors.push({type:'edad_invalida', message:'Edad cronológica ausente o inválida.'});
  if(assessment && dateCheck.error==='evaluacion_antes_nacimiento') errors.push({type:'evaluacion_antes_nacimiento', message:'La fecha de evaluación no puede ser anterior al nacimiento.'});
  const validCodes=new Set((items??[]).map(i=>i.codigo_canonico));
  for(const [code, score] of Object.entries(assessment?.observedResponses ?? {})){
    const canon=normalizeItemCode(code); if(!validCodes.has(canon)) errors.push({type:'codigo_invalido', code, message:`Código de respuesta desconocido: ${code}`});
    if(![0,1,2].includes(score)) errors.push({type:'puntuacion_invalida', code, message:`Puntuación inválida en ${code}.`});
  }
  if(Object.keys(assessment?.observedResponses ?? {}).length===0) errors.push({type:'sin_respuestas', message:'Introduce al menos una respuesta observada antes de corregir.'});
  return { ok: errors.length===0, errors, ageMonths: age };
}
function pendingReason(code, sub){
  if(sub.requiere_revision) return 'contradicción que requiere revisión';
  if(sub.techo?.provisional) return 'techo provisional';
  if(!sub.basal?.confirmado) return 'basal no confirmado';
  if(!sub.techo?.confirmado) return 'techo no confirmado';
  return 'hueco interior entre basal y techo';
}
export function buildPendingItemsReport({ scoring, items }){
  const byCode=new Map(items.map(i=>[i.codigo_canonico,i])); const pending=[];
  for(const sub of Object.values(scoring?.subareas ?? {})) for(const code of sub.pendientes ?? []){ const item=byCode.get(code); const motivo=pendingReason(code, sub); pending.push({ code, area:item?.area ?? sub.area, subarea:item?.subarea ?? sub.subarea, statement:item?.enunciado ?? '', ageRange:item?.rango_edad ?? '', reason:motivo }); }
  const byArea={}; const bySubarea={}; for(const p of pending){ byArea[p.area]=(byArea[p.area]??0)+1; bySubarea[`${p.area}|${p.subarea}`]=(bySubarea[`${p.area}|${p.subarea}`]??0)+1; }
  return { total: pending.length, byArea, bySubarea, items: pending };
}
function pctStatus(p){ if(!p) return {status:'error_datos', label:'Error de datos'}; if(p.ok) return {status:'valido', label:`Percentil ${p.percentile}`, ...p}; if(p.error.code==='escala_sin_percentil'||p.error.code==='escala_no_encontrada') return {status:'no_aplicable', label:'Escala no aplicable al tramo', error:p.error}; if(p.error.code==='baremos_pendientes'||p.error.code==='tramo_no_disponible'||p.error.code==='tramo_no_encontrado') return {status:'baremos_pendientes', label:NORMATIVE_PENDING_MESSAGE, error:p.error}; return {status:'error_datos', label:p.error.message, error:p.error}; }
function fmtEq(eq){ if(!eq?.ok) return null; return eq.minMonths===eq.maxMonths ? `${eq.minMonths} meses` : `${eq.minMonths}–${eq.maxMonths} meses`; }
function subareaCounts(sub, scoring){ const counts={observed:0, derivedByBasal:0, derivedByCeiling:0, notAdministered:0, directScore:sub.pd}; for(const code of sub.codigos ?? []){ const r=scoring.respuestas_efectivas?.[code]; if(!r || r.puntuacion===null) counts.notAdministered++; else if(r.origen==='observado') counts.observed++; else if(r.origen==='basal') counts.derivedByBasal++; else if(r.origen==='techo') counts.derivedByCeiling++; } return counts; }
export function buildCorrectionResults({ assessment, scoring, model, percentiles, equivalentAges }){
  const ageMonths=effectiveAgeMonths(assessment); const subareas={}; const scales={};
  for(const [id,s] of Object.entries(scoring.subareas ?? {})){ const pct=s.pd!==null ? pctStatus(percentileForScale({ageMonths,scaleId:id,directScore:s.pd,percentileData:percentiles,requiresReview:s.requiere_revision,maxScore:s.maximo})) : null; subareas[id]={...s, counts:subareaCounts(s, scoring), percentile:pct, status:s.completa?'válido':'incompleto'}; }
  for(const id of MAIN_SCALES){ const s=scoring.escalas[id]; if(!s) continue; const pct=id==='battelle_total'||s.pd===null ? {status:'no_aplicable', label:'Battelle total no tiene percentil propio en este flujo'} : pctStatus(percentileForScale({ageMonths,scaleId:id,directScore:s.pd,percentileData:percentiles,requiresReview:s.requiere_revision,maxScore:s.maximo})); const eq=s.pd!==null ? equivalentAgeForScale({scaleId:id,directScore:s.pd,equivalentAgeData:equivalentAges,requiresReview:s.requiere_revision,maxScore:s.maximo}) : null; scales[id]={...s, name:model.escalas[id]?.nombre ?? id, percentile:pct, equivalentAge:eq, equivalentAgeLabel:fmtEq(eq), confidence:eq?.confidence ?? pct?.confidence ?? 'baremos pendientes'}; }
  const observed=Object.keys(assessment.observedResponses??{}).length; const derivedBasal=Object.values(scoring.respuestas_efectivas??{}).filter(r=>r.origen==='basal').length; const derivedCeiling=Object.values(scoring.respuestas_efectivas??{}).filter(r=>r.origen==='techo').length;
  return { summary:{ name:assessment.name, birthDate:assessment.birthDate, assessmentDate:assessment.assessmentDate, ageMonths, ageBand:ageBandForMonths(ageMonths)?.label ?? null, observedResponses:observed, derivedByBasal:derivedBasal, derivedByCeiling:derivedCeiling }, subareas, scales };
}
export function buildDescriptiveSummary({ results }){
  const out=['Síntesis descriptiva automática basada exclusivamente en las puntuaciones directas disponibles. Requiere interpretación profesional.', NORMATIVE_PENDING_MESSAGE]; const age=results.summary.ageMonths; if(Number.isInteger(age)) out.push(`La edad cronológica es de ${age} meses.`);
  for(const [id,s] of Object.entries(results.scales)){ if(s.equivalentAgeLabel) { out.push(`${s.name} obtiene una edad equivalente de ${s.equivalentAgeLabel}.`); if(Number.isInteger(age) && s.equivalentAge?.ok){ const min=age-s.equivalentAge.maxMonths, max=age-s.equivalentAge.minMonths; if(min>0) out.push(`La edad equivalente de ${s.name} se sitúa aproximadamente ${min===max?min:`${min}–${max}`} meses por debajo de la edad cronológica.`); } } if(s.percentile?.status==='valido') out.push(`El percentil de ${s.name} es ${s.percentile.percentile}.`); if(s.percentile?.status==='baremos_pendientes') out.push(NORMATIVE_PENDING_MESSAGE); }
  return out.filter(t=>!/retraso|leve|moderado|grave|diagn[oó]stico|ECN|puntuaci[oó]n z|\bT\b/i.test(t));
}
export function runCorrection({ assessment, items, model, percentiles, equivalentAges, scoreAssessment, dataVersion, modelVersion, now = new Date() }){
  const pre=validateCorrectionPrerequisites({assessment,items}); const fingerprint=createCorrectionFingerprint({assessment,dataVersion,modelVersion});
  if(!pre.ok) return {ok:false,status:'correccion_bloqueada',fingerprint,correctedAt:null,scoring:null,results:null,pendingReport:{total:0,byArea:{},bySubarea:{},items:[]},errors:pre.errors,inconsistencies:[],summary:[]};
  let scoring; try{ scoring=scoreAssessment(items, model, assessment.observedResponses); }catch(error){ return {ok:false,status:'correccion_bloqueada',fingerprint,correctedAt:null,scoring:null,results:null,pendingReport:{total:0,byArea:{},bySubarea:{},items:[]},errors:[{type:'error_motor',message:error.message}],inconsistencies:[],summary:[]}; }
  const pendingReport=buildPendingItemsReport({scoring,items}); const errors=[...(scoring.errores??[]).map(e=>({type:'error_motor',message:e.mensaje??e.message}))];
  for(const sub of Object.values(scoring.subareas??{})){ if(sub.techo?.provisional) errors.push({type:'techo_provisional',message:`Techo provisional en ${sub.subarea}.`}); if(sub.requiere_revision) errors.push({type:'requiere_revision',message:`${sub.subarea} requiere revisión.`}); if(!sub.completa) errors.push({type:'subarea_incompleta',message:`Subárea incompleta: ${sub.subarea}.`}); }
  for(const [id,s] of Object.entries(scoring.escalas??{})) if(!s.completa) errors.push({type:'escala_incompleta',message:`Escala principal incompleta: ${model.escalas[id]?.nombre ?? id}.`});
  if(pendingReport.total) errors.push({type:'items_pendientes',message:`Hay ${pendingReport.total} ítems sin puntuación efectiva.`});
  if(errors.length) return {ok:false,status:'correccion_bloqueada',fingerprint,correctedAt:null,scoring:null,results:null,pendingReport,errors,inconsistencies:scoring.inconsistencias??[],summary:[]};
  const results=buildCorrectionResults({assessment,scoring,model,percentiles,equivalentAges}); const correctedAt=now.toISOString(); results.summary.correctedAt=correctedAt; const summary=buildDescriptiveSummary({results});
  return {ok:true,status:'corregida',fingerprint,correctedAt,scoring,results,pendingReport,errors:[],inconsistencies:[],summary};
}
