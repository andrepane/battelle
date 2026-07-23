import { normalizeItemCode } from './battelle-data.js';
import { SCHEMA_VERSION, calculateAgeMonths } from './battelle-state.js';
import { ageBandForMonths, canonicalNormativeId, equivalentAgeForScale, lookupGeneralConversion, lookupTotalCentile, percentileForScale, validateNormativeData } from './battelle-conversions.js';

export const CORRECTION_STATUSES = Object.freeze(['administrando','corrigiendo','corregida','resultado_desactualizado','correccion_bloqueada']);
const MAIN_SCALES = ['personal_social_total','adaptativa_total','motora_gruesa','motora_fina','motora_total','comunicacion_receptiva','comunicacion_expresiva','comunicacion_total','cognitiva_total','battelle_total'];
function stable(value){ if(Array.isArray(value)) return `[${value.map(stable).join(',')}]`; if(value && typeof value==='object'){ return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`; } return JSON.stringify(value); }
export function effectiveAgeMonths(assessment){ if(!assessment) return null; if(assessment.manualAgeOverride) return Number.isInteger(assessment.ageMonths) ? assessment.ageMonths : null; const r=calculateAgeMonths(assessment.birthDate, assessment.assessmentDate); return r.ok ? r.months : null; }
export function createCorrectionFingerprint({ assessment, dataVersion='items-v1', modelVersion='model-v1', normativeVersion='baremos-json-v1' }){
  return stable({ schemaVersion: SCHEMA_VERSION, dataVersion, modelVersion, normativeVersion, birthDate:assessment?.birthDate ?? '', assessmentDate:assessment?.assessmentDate ?? '', manualAgeOverride:!!assessment?.manualAgeOverride, ageMonths:effectiveAgeMonths(assessment), observedResponses:assessment?.observedResponses ?? {} });
}
export function isCorrectionStale({ assessment, correction, dataVersion, modelVersion }){ return !correction?.fingerprint || correction.fingerprint !== createCorrectionFingerprint({ assessment, dataVersion, modelVersion, normativeVersion: correction.normativeVersion }); }
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
function normStatus(p, kind='percentil'){ if(!p) return {status:'error_baremos', label:'Error de baremos'}; if(p.ok) return {status:'valido', label:kind==='percentil'?`Percentil ${p.percentile}`:kind==='centil'?`Centil ${p.centile}`:'Válido', ...p}; const map={escala_no_incluida:'no_aplicable',edad_fuera_de_baremos:'fuera_rango_normativo',pd_fuera_de_rango:'fuera_rango_normativo',pd_no_alcanzable:'no_alcanzable',pd_invalida:'error_datos',baremo_no_encontrado:'error_baremos'}; return {status:map[p.error.code]??'error_baremos', label:p.error.message, error:p.error}; }
function fmtEq(eq){ if(!eq?.ok) return null; return eq.minMonths===eq.maxMonths ? `${eq.minMonths} meses` : `${eq.minMonths}–${eq.maxMonths} meses`; }
function subareaCounts(sub, scoring){ const counts={observed:0, derivedByBasal:0, derivedByCeiling:0, notAdministered:0, directScore:sub.pd}; for(const code of sub.codigos ?? []){ const r=scoring.respuestas_efectivas?.[code]; if(!r || r.puntuacion===null) counts.notAdministered++; else if(r.origen==='observado') counts.observed++; else if(r.origen==='basal') counts.derivedByBasal++; else if(r.origen==='techo') counts.derivedByCeiling++; } return counts; }
export function buildCorrectionResults({ assessment, scoring, model, normativeData, dataVersion, modelVersion }){
  const ageMonths=effectiveAgeMonths(assessment); const subareas={}; const scales={}; const warnings=[]; const errors=[]; const provenance=[];
  for(const [id,s] of Object.entries(scoring.subareas ?? {})){ const pct=s.pd!==null ? normStatus(percentileForScale({ageMonths,scaleId:id,directScore:s.pd,normativeData,requiresReview:s.requiere_revision,maxScore:s.maximo})) : null; subareas[id]={...s, counts:subareaCounts(s, scoring), percentile:pct, status:s.completa?'válido':'incompleto'}; }
  for(const id of MAIN_SCALES){ const s=scoring.escalas[id]; if(!s) continue; const pct=id==='battelle_total'||s.pd===null ? {status:'no_aplicable', label:'Battelle total no tiene percentil propio en este flujo'} : normStatus(percentileForScale({ageMonths,scaleId:id,directScore:s.pd,normativeData,requiresReview:s.requiere_revision,maxScore:s.maximo})); const eq=s.pd!==null ? equivalentAgeForScale({scaleId:id,directScore:s.pd,normativeData,requiresReview:s.requiere_revision,maxScore:s.maximo}) : null; scales[id]={...s, name:model.escalas[id]?.nombre ?? id, percentile:pct, equivalentAge:eq, equivalentAgeLabel:fmtEq(eq), confidence:eq?.confidence ?? 'normativo'}; }
  const total=scoring.escalas?.battelle_total; const totalCentile=total?.pd!=null?normStatus(lookupTotalCentile({ageMonths,directScore:total.pd,normativeData,maxScore:total.maximo}),'centil'):null; const n1=totalCentile?.ok?lookupGeneralConversion({pc:totalCentile.centile,normativeData}):{ok:false,error:{code:'baremo_no_encontrado',message:'N-1 no ejecutado porque N-2 no produjo un centil válido.'}}; const totalEq=total?.pd!=null?equivalentAgeForScale({scaleId:'battelle_total',directScore:total.pd,normativeData,maxScore:total.maximo}):null; const observed=Object.keys(assessment.observedResponses??{}).length; const derivedBasal=Object.values(scoring.respuestas_efectivas??{}).filter(r=>r.origen==='basal').length; const derivedCeiling=Object.values(scoring.respuestas_efectivas??{}).filter(r=>r.origen==='techo').length;
  return Object.freeze({ metadata:{ name:assessment.name, birthDate:assessment.birthDate, assessmentDate:assessment.assessmentDate }, summary:{ name:assessment.name, birthDate:assessment.birthDate, assessmentDate:assessment.assessmentDate, ageMonths, ageBand:ageBandForMonths(ageMonths)?.label ?? null, observedResponses:observed, derivedByBasal:derivedBasal, derivedByCeiling:derivedCeiling, directScoreTotal: total?.pd ?? null, totalCentile, generalConversion:n1, totalEquivalentAge:totalEq }, subareas, scales, percentiles:Object.fromEntries(Object.entries(scales).map(([k,v])=>[k,v.percentile])), totalCentile, generalConversion:n1, equivalentAges:Object.fromEntries(Object.entries(scales).map(([k,v])=>[k,v.equivalentAge])), warnings, errors, provenance, normative:{version:normativeData?.metadata?.version_esquema??'baremos-json-v1',id:canonicalNormativeId(normativeData),dataVersion,modelVersion} });
}
export function buildDescriptiveSummary({ results }){
  const out=['Síntesis descriptiva automática basada exclusivamente en resultados válidos. La interpretación clínica corresponde al profesional.']; const age=results.summary.ageMonths; if(Number.isInteger(age)) out.push(`La edad cronológica es de ${age} meses.`);
  for(const [id,s] of Object.entries(results.scales)){ if(s.equivalentAgeLabel) { out.push(`${s.name} obtiene una edad equivalente de ${s.equivalentAgeLabel}.`); if(Number.isInteger(age) && s.equivalentAge?.ok){ const min=age-s.equivalentAge.maxMonths, max=age-s.equivalentAge.minMonths; if(min>0) out.push(`La edad equivalente de ${s.name} se sitúa aproximadamente ${min===max?min:`${min}–${max}`} meses por debajo de la edad cronológica.`); } } if(s.percentile?.status==='valido') out.push(`El percentil de ${s.name} es ${s.percentile.percentile}.`);  }
  return out.filter(t=>!/retraso|leve|moderado|grave|diagn[oó]stico|ECN|puntuaci[oó]n z|\bT\b/i.test(t));
}
export function runCorrection({ assessment, items, model, normativeData, scoreAssessment, dataVersion, modelVersion, now = new Date() }){
  const normative=normativeData ? validateNormativeData(normativeData, model) : {ok:true,id:'baremos-test',errors:[]}; const fingerprint=createCorrectionFingerprint({assessment,dataVersion,modelVersion,normativeVersion:normative.id});
  if(!normative.ok) return {ok:false,status:'correccion_bloqueada',fingerprint,normativeVersion:normative.id,correctedAt:null,scoring:null,results:null,pendingReport:{total:0,byArea:{},bySubarea:{},items:[]},errors:normative.errors.map(message=>({type:'baremos_invalidos',message})),inconsistencies:[],summary:[]};
  const pre=validateCorrectionPrerequisites({assessment,items});
  if(!pre.ok) return {ok:false,status:'correccion_bloqueada',fingerprint,correctedAt:null,scoring:null,results:null,pendingReport:{total:0,byArea:{},bySubarea:{},items:[]},errors:pre.errors,inconsistencies:[],summary:[]};
  let scoring; try{ scoring=scoreAssessment(items, model, assessment.observedResponses); }catch(error){ return {ok:false,status:'correccion_bloqueada',fingerprint,correctedAt:null,scoring:null,results:null,pendingReport:{total:0,byArea:{},bySubarea:{},items:[]},errors:[{type:'error_motor',message:error.message}],inconsistencies:[],summary:[]}; }
  const pendingReport=buildPendingItemsReport({scoring,items}); const errors=[...(scoring.errores??[]).map(e=>({type:'error_motor',message:e.mensaje??e.message}))];
  for(const sub of Object.values(scoring.subareas??{})){ if(sub.techo?.provisional) errors.push({type:'techo_provisional',message:`Techo provisional en ${sub.subarea}.`}); if(sub.requiere_revision) errors.push({type:'requiere_revision',message:`${sub.subarea} requiere revisión.`}); if(!sub.completa) errors.push({type:'subarea_incompleta',message:`Subárea incompleta: ${sub.subarea}.`}); }
  for(const [id,s] of Object.entries(scoring.escalas??{})) if(!s.completa) errors.push({type:'escala_incompleta',message:`Escala principal incompleta: ${model.escalas[id]?.nombre ?? id}.`});
  if(pendingReport.total) errors.push({type:'items_pendientes',message:`Hay ${pendingReport.total} ítems sin puntuación efectiva.`});
  if(errors.length) return {ok:false,status:'correccion_bloqueada',fingerprint,correctedAt:null,scoring:null,results:null,pendingReport,errors,inconsistencies:scoring.inconsistencias??[],summary:[]};
  const results=buildCorrectionResults({assessment,scoring,model,normativeData,dataVersion,modelVersion}); const correctedAt=now.toISOString(); results.summary.correctedAt=correctedAt; const summary=buildDescriptiveSummary({results});
  return {ok:true,status:'corregida',fingerprint,normativeVersion:normative.id,correctedAt,scoring,results,pendingReport,errors:[],inconsistencies:[],summary};
}
