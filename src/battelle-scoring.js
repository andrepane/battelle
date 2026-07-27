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
function groupBy(items, fn){ const m=new Map(); for (const item of items){ const k=fn(item); if(!m.has(k)) m.set(k,[]); m.get(k).push(item);} return m; }
const ageKey=(item)=>`${item.rango_edad_min_meses}|${item.rango_edad_max_meses}`;
function ageLevels(items){ return [...groupBy(items, ageKey).values()]; }

export function detectBasal(items, observed) {
  const levels=ageLevels(items);
  // The highest fully passed administered level is the useful basal: all lower,
  // unadministered levels can then be derived without changing observations.
  for (let levelIndex=levels.length-1;levelIndex>=0;levelIndex--) {
    const level=levels[levelIndex];
    if (level.every((item)=>observed[item.codigo_canonico]?.puntuacion===2)) {
      const start=items.indexOf(level[0]); const end=items.indexOf(level.at(-1));
      return {confirmado:true, inicio:level[0].codigo_canonico, fin:level.at(-1).codigo_canonico, indice_inicio:start, indice_fin:end, nivel_indice:levelIndex, rango_edad:level[0].rango_edad, sustentan:level.map((i)=>i.codigo_canonico)};
    }
  }
  const attempted=[...levels].reverse().find((level)=>level.some((item)=>observed[item.codigo_canonico]));
  const pendientes=attempted?.filter((item)=>!observed[item.codigo_canonico]).map((item)=>item.codigo_canonico) ?? [];
  return {confirmado:false, rango_edad:attempted?.[0]?.rango_edad, pendientes};
}

export function detectCeiling(items, observed, basal=null) {
  const inconsistencias=[]; let provisional=false;
  for (let i=0;i<items.length-1;i++) {
    if (basal?.confirmado && i <= basal.indice_fin) continue;
    if (observed[items[i].codigo_canonico]?.puntuacion===0 && observed[items[i+1].codigo_canonico]?.puntuacion===0) {
      // Reaching the first item and scoring every item up to the ceiling is a
      // valid floor administration: some children never establish a basal.
      // Only keep the ceiling provisional when there are unobserved items below it.
      const sueloComprobado=!basal?.confirmado && items.slice(0,i+2).every((item)=>observed[item.codigo_canonico]);
      provisional=!basal?.confirmado && !sueloComprobado; if (provisional) inconsistencias.push({tipo:'techo_provisional', mensaje:'Techo detectado sin basal confirmado ni suelo comprobado.'});
      return {confirmado:true, inicio:items[i].codigo_canonico, fin:items[i+1].codigo_canonico, indice_inicio:i, indice_fin:i+1, rango_edad:items[i].rango_edad, provisional, inconsistencias, sustentan:[items[i].codigo_canonico,items[i+1].codigo_canonico]};
    }
  }
  return {confirmado:false, inconsistencias};
}

export function deriveScores(items, responses = {}) {
  const validCodes = new Set(items.map((i)=>i.codigo_canonico));
  const observed = normalizeObservedResponses(responses, validCodes);
  const effective = blank(items);
  for (const [code, response] of Object.entries(observed)) if (validCodes.has(code)) effective[code] = response;
  const inconsistencias=[]; const advertencias=[]; const bySub = groupBy(items, (i)=>`${i.area}|${i.subarea}`); const limites={};
  for (const [key, subItems] of bySub) {
    let basal = detectBasal(subItems, observed); const techo = detectCeiling(subItems, observed, basal);
    if(!basal.confirmado && techo.confirmado && !techo.provisional) basal={...basal, agotado:true};
    limites[key]={basal, techo};
    if (basal.confirmado) for (let i=0;i<basal.indice_inicio;i++){ const code=subItems[i].codigo_canonico; if (!observed[code]) effective[code]={estado:'derivado',puntuacion:2,origen:'basal',observacion:''}; else if (observed[code].puntuacion<2) advertencias.push({tipo:'discrepancia_basal', codigo:code, subarea:key, mensaje:'Respuesta observada inferior al basal conservada para revisión clínica.'}); }
    if (techo.confirmado && !techo.provisional) for (let i=techo.indice_fin+1;i<subItems.length;i++){ const code=subItems[i].codigo_canonico; if (!observed[code]) effective[code]={estado:'derivado',puntuacion:0,origen:'techo',observacion:''}; else if (observed[code].puntuacion>0) inconsistencias.push({tipo:'inconsistencia_techo', codigo:code, subarea:key, mensaje:'Respuesta observada posterior contradice el techo.'}); }
    inconsistencias.push(...(techo.inconsistencias??[]).map((w)=>({...w, subarea:key})));
  }
  return { respuestas_observadas: observed, respuestas_efectivas: effective, limites, inconsistencias, advertencias };
}

export function administrationSummary(items, scoring) {
  const observed=scoring.respuestas_observadas; const effective=scoring.respuestas_efectivas;
  const basal=scoring.basal; const techo=scoring.techo;
  const counts={observed:0,derivedByBasal:0,derivedByCeiling:0,pending:0};
  for (const item of items) { const r=effective[item.codigo_canonico]; if(r?.origen==='observado') counts.observed++; else if(r?.origen==='basal') counts.derivedByBasal++; else if(r?.origen==='techo') counts.derivedByCeiling++; else counts.pending++; }
  const inconsistencies=scoring.inconsistencias??[];
  const warnings=scoring.advertencias??[];
  let status='sin iniciar'; let instruction='Comienza en el nivel de edad inicial recomendado.';
  if(counts.observed) { status=basal.confirmado?'buscando techo':'buscando basal';
    if(!basal.confirmado && basal.pendientes?.length) instruction=`Basal no confirmado. Completa los ítems ${basal.pendientes.join(' y ')} del nivel ${basal.rango_edad} meses.`;
    else if(!basal.confirmado) instruction='Basal no establecido. Retrocede al nivel de edad anterior.';
    else { const lastObserved=[...items].reverse().find((i)=>observed[i.codigo_canonico]); instruction=lastObserved && observed[lastObserved.codigo_canonico].puntuacion===0 ? 'Primer cero registrado. Administra el siguiente ítem para comprobar el techo.' : 'Continúa administrando en orden hasta obtener dos ceros consecutivos.'; }
  }
  if(techo.confirmado && !techo.provisional) { status='completa'; instruction=basal.agotado?'Techo confirmado tras administrar desde el primer ítem; no se estableció basal.':'Techo confirmado.'; }
  if(inconsistencies.length || warnings.length) status='requiere revisión';
  return {status,instruction,counts,basal,techo};
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
      const basal=deriv.limites[definition.clave]?.basal ?? {confirmado:false}; const techo=deriv.limites[definition.clave]?.techo ?? {confirmado:false};
      const advertencias=deriv.advertencias.filter((w)=>w.subarea===definition.clave);
      const base={...calculateScaleScore(codes, deriv.respuestas_efectivas, inconsistencias), codigos: codes, area: definition.area, subarea: definition.subarea, basal, techo, advertencias};
      subareas[id]={...base, administracion:administrationSummary(codes.map((code)=>items.find((item)=>item.codigo_canonico===code)), {...base,respuestas_observadas:deriv.respuestas_observadas,respuestas_efectivas:deriv.respuestas_efectivas})};
    }
    const escalas=calculateAllScores(items, model, deriv.respuestas_efectivas, subareas);
    return {...deriv, subareas, escalas, evaluacion_completa:Object.values(escalas).every((s)=>s.completa), errores:[]};
  } catch (error) {
    return { respuestas_observadas:{}, respuestas_efectivas:{}, subareas:{}, escalas:{}, evaluacion_completa:false, errores:[{tipo:'entrada_invalida', mensaje:error.message}], advertencias:[], inconsistencias:[] };
  }
}
