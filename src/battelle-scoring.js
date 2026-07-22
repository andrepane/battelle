import { itemCodesForScale } from './battelle-scales.js';

export function validateResponse(value) { if (![0,1,2].includes(value)) throw new Error(`Puntuación inválida: ${value}`); return value; }
export function normalizeObservedResponses(responses = {}) {
  const out = {};
  for (const [code, raw] of Object.entries(responses)) {
    const puntuacion = typeof raw === 'object' && raw !== null ? raw.puntuacion : raw;
    validateResponse(puntuacion);
    out[code.replace(/\s+/g,'')] = { estado:'administrado', puntuacion, origen:'observado', observacion: (raw && raw.observacion) || '' };
  }
  return out;
}
function blank(items){ return Object.fromEntries(items.map((i)=>[i.codigo_canonico,{estado:'no_administrado',puntuacion:null,origen:null,observacion:''}])); }
const sameRange=(a,b)=>a.rango_edad_min_meses===b.rango_edad_min_meses&&a.rango_edad_max_meses===b.rango_edad_max_meses;
function groupBy(items, fn){ const m=new Map(); for (const item of items){ const k=fn(item); if(!m.has(k)) m.set(k,[]); m.get(k).push(item);} return m; }
export function detectBasal(items, observed) {
  for (let i=0;i<items.length-1;i++) if (observed[items[i].codigo_canonico]?.puntuacion===2 && observed[items[i+1].codigo_canonico]?.puntuacion===2 && sameRange(items[i],items[i+1])) return {confirmado:true, inicio:items[i].codigo_canonico, fin:items[i+1].codigo_canonico, indice_fin:i+1, rango_edad:items[i].rango_edad};
  return {confirmado:false};
}
export function detectCeiling(items, observed, basal=null) {
  const advertencias=[]; let provisional=false;
  for (let i=0;i<items.length-1;i++) {
    if (basal?.confirmado && i <= basal.indice_fin) continue;
    if (observed[items[i].codigo_canonico]?.puntuacion===0 && observed[items[i+1].codigo_canonico]?.puntuacion===0 && sameRange(items[i],items[i+1])) {
      provisional=!basal?.confirmado; if (provisional) advertencias.push({tipo:'techo_provisional', mensaje:'Techo detectado sin basal confirmado.'});
      return {confirmado:true, inicio:items[i].codigo_canonico, fin:items[i+1].codigo_canonico, indice_inicio:i, rango_edad:items[i].rango_edad, provisional, advertencias};
    }
  }
  return {confirmado:false, advertencias};
}
export function deriveScores(items, responses = {}) {
  const observed = normalizeObservedResponses(responses); const effective = blank(items); Object.assign(effective, observed);
  const advertencias=[]; const bySub = groupBy(items, (i)=>`${i.area}|${i.subarea}`); const limites={};
  for (const [key, subItems] of bySub) {
    const basal = detectBasal(subItems, observed); const techo = detectCeiling(subItems, observed, basal); limites[key]={basal, techo};
    if (basal.confirmado) for (let i=0;i<basal.indice_fin-1;i++){ const code=subItems[i].codigo_canonico; if (!observed[code]) effective[code]={estado:'derivado',puntuacion:2,origen:'basal',observacion:''}; else if (observed[code].puntuacion<2) advertencias.push({tipo:'inconsistencia_basal', codigo:code, subarea:key}); }
    if (techo.confirmado) for (let i=techo.indice_inicio+2;i<subItems.length;i++){ const code=subItems[i].codigo_canonico; if (!observed[code]) effective[code]={estado:'derivado',puntuacion:0,origen:'techo',observacion:''}; else if (observed[code].puntuacion>0) advertencias.push({tipo:'inconsistencia_techo', codigo:code, subarea:key}); }
    advertencias.push(...(techo.advertencias??[]).map((w)=>({...w, subarea:key})));
  }
  return { respuestas_observadas: observed, respuestas_efectivas: effective, limites, advertencias };
}
export function calculateScaleScore(codes, effective) {
  let pd_parcial=0; const pendientes=[];
  for (const code of codes) { const r=effective[code]; if (!r || r.puntuacion===null) pendientes.push(code); else pd_parcial += r.puntuacion; }
  return { pd: pendientes.length ? null : pd_parcial, pd_parcial, maximo: codes.length*2, completa: pendientes.length===0, pendientes };
}
export function calculateAllScores(items, model, effective) {
  const escalas={}; for (const [id, scale] of Object.entries(model.escalas)) escalas[id]=calculateScaleScore(itemCodesForScale(scale,items), effective);
  return escalas;
}
export function assessCompleteness(result) { return Object.values(result.escalas).every((s)=>s.completa); }
export function scoreAssessment(items, model, responses = {}) {
  const deriv = deriveScores(items, responses); const subareas={}; const bySub=groupBy(items,(i)=>`${i.area}|${i.subarea}`);
  for (const [key, subItems] of bySub) subareas[key]={...calculateScaleScore(subItems.map((i)=>i.codigo_canonico), deriv.respuestas_efectivas), ...deriv.limites[key], advertencias:deriv.advertencias.filter((w)=>w.subarea===key)};
  const escalas=calculateAllScores(items, model, deriv.respuestas_efectivas); return {...deriv, subareas, escalas, evaluacion_completa:Object.values(escalas).every((s)=>s.completa), errores:[]};
}
