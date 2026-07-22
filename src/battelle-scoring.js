import { normalizeItemCode } from './battelle-data.js';
import { itemCodesForScale, declaredSubareaEntries, itemCodesForSubarea } from './battelle-scales.js';

export function validateResponse(value) { if (![0,1,2].includes(value)) throw new Error(`Puntuación inválida: ${value}`); return value; }

export function normalizeObservedResponses(responses = {}, validCodes = null) {
  const out = {};
  for (const [code, raw] of Object.entries(responses)) {
    if (code === '') throw new Error('Código de respuesta vacío');
    const codigoCanonico = normalizeItemCode(code);
    if (validCodes && !validCodes.has(codigoCanonico)) throw new Error(`Código de respuesta desconocido: ${code}`);
    if (out[codigoCanonico]) throw new Error(`Código de respuesta duplicado tras normalización: ${code}`);
    const puntuacion = typeof raw === 'object' && raw !== null ? raw.puntuacion : raw;
    validateResponse(puntuacion);
    out[codigoCanonico] = { estado:'administrado', puntuacion, origen:'observado', observacion: (raw && raw.observacion) || '' };
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
  const inconsistencias=[]; let provisional=false;
  for (let i=0;i<items.length-1;i++) {
    if (basal?.confirmado && i <= basal.indice_fin) continue;
    if (observed[items[i].codigo_canonico]?.puntuacion===0 && observed[items[i+1].codigo_canonico]?.puntuacion===0 && sameRange(items[i],items[i+1])) {
      provisional=!basal?.confirmado; if (provisional) inconsistencias.push({tipo:'techo_provisional', mensaje:'Techo detectado sin basal confirmado.'});
      return {confirmado:true, inicio:items[i].codigo_canonico, fin:items[i+1].codigo_canonico, indice_inicio:i, rango_edad:items[i].rango_edad, provisional, inconsistencias};
    }
  }
  return {confirmado:false, inconsistencias};
}

export function deriveScores(items, responses = {}) {
  const validCodes = new Set(items.map((i)=>i.codigo_canonico));
  const observed = normalizeObservedResponses(responses, validCodes);
  const effective = blank(items);
  for (const [code, response] of Object.entries(observed)) if (validCodes.has(code)) effective[code] = response;
  const inconsistencias=[]; const bySub = groupBy(items, (i)=>`${i.area}|${i.subarea}`); const limites={};
  for (const [key, subItems] of bySub) {
    const basal = detectBasal(subItems, observed); const techo = detectCeiling(subItems, observed, basal); limites[key]={basal, techo};
    if (basal.confirmado) for (let i=0;i<basal.indice_fin-1;i++){ const code=subItems[i].codigo_canonico; if (!observed[code]) effective[code]={estado:'derivado',puntuacion:2,origen:'basal',observacion:''}; else if (observed[code].puntuacion<2) inconsistencias.push({tipo:'inconsistencia_basal', codigo:code, subarea:key, mensaje:'Respuesta observada anterior contradice el basal.'}); }
    if (techo.confirmado) for (let i=techo.indice_inicio+2;i<subItems.length;i++){ const code=subItems[i].codigo_canonico; if (!observed[code]) effective[code]={estado:'derivado',puntuacion:0,origen:'techo',observacion:''}; else if (observed[code].puntuacion>0) inconsistencias.push({tipo:'inconsistencia_techo', codigo:code, subarea:key, mensaje:'Respuesta observada posterior contradice el techo.'}); }
    inconsistencias.push(...(techo.inconsistencias??[]).map((w)=>({...w, subarea:key})));
  }
  return { respuestas_observadas: observed, respuestas_efectivas: effective, limites, inconsistencias, advertencias: [] };
}

export function calculateScaleScore(codes, effective, inconsistencias = []) {
  let pd_parcial=0; const pendientes=[];
  for (const code of codes) { const r=effective[code]; if (!r || r.puntuacion===null) pendientes.push(code); else pd_parcial += r.puntuacion; }
  const requiere_revision = inconsistencias.length > 0;
  return { pd: pendientes.length || requiere_revision ? null : pd_parcial, pd_parcial, maximo: codes.length*2, completa: pendientes.length===0 && !requiere_revision, requiere_revision, pendientes, inconsistencias };
}

export function calculateAllScores(items, model, effective, subareas = {}) {
  const escalas={};
  const subareaByCode = new Map();
  for (const [key, result] of Object.entries(subareas)) for (const code of result.codigos ?? []) subareaByCode.set(code, { key, result });
  for (const [id, scale] of Object.entries(model.escalas)) {
    const codes = itemCodesForScale(scale, items, model);
    const seenSubareas = new Map(codes.map((code)=>[subareaByCode.get(code)?.key, subareaByCode.get(code)?.result]).filter(([key])=>key));
    const inconsistencias = [...seenSubareas.values()].flatMap((s)=>s.requiere_revision ? s.inconsistencias : []);
    escalas[id]=calculateScaleScore(codes, effective, inconsistencias);
  }
  return escalas;
}
export function assessCompleteness(result) { return Object.values(result.escalas).every((s)=>s.completa); }

export function scoreAssessment(items, model, responses = {}) {
  try {
    const deriv = deriveScores(items, responses); const subareas={};
    for (const [id, definition] of declaredSubareaEntries(model)) {
      const codes = itemCodesForSubarea(definition, items);
      const inconsistencias = deriv.inconsistencias.filter((w)=>w.subarea===definition.clave);
      subareas[id]={...calculateScaleScore(codes, deriv.respuestas_efectivas, inconsistencias), codigos: codes, area: definition.area, subarea: definition.subarea, basal: deriv.limites[definition.clave]?.basal ?? {confirmado:false}, techo: deriv.limites[definition.clave]?.techo ?? {confirmado:false}, advertencias: []};
    }
    const escalas=calculateAllScores(items, model, deriv.respuestas_efectivas, subareas);
    return {...deriv, subareas, escalas, evaluacion_completa:Object.values(escalas).every((s)=>s.completa), errores:[]};
  } catch (error) {
    return { respuestas_observadas:{}, respuestas_efectivas:{}, subareas:{}, escalas:{}, evaluacion_completa:false, errores:[{tipo:'entrada_invalida', mensaje:error.message}], advertencias:[], inconsistencias:[] };
  }
}
