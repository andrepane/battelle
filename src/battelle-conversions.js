export const AGE_BANDS = Object.freeze([
  { min: 0, max: 5, label: '0-5' }, { min: 6, max: 11, label: '6-11' },
  { min: 12, max: 17, label: '12-17' }, { min: 18, max: 23, label: '18-23' },
  { min: 24, max: 35, label: '24-35' }, { min: 36, max: 47, label: '36-47' },
  { min: 48, max: 59, label: '48-59' }, { min: 60, max: 71, label: '60-71' },
  { min: 72, max: 83, label: '72-83' }, { min: 84, max: 95, label: '84-95' },
]);
export const PERCENTILE_SCALE_NAMES = Object.freeze({
  personal_social_total: 'Personal/Social total', adaptativa_total: 'Adaptativa total', motora_gruesa: 'Motora gruesa', motora_fina: 'Motora fina', motora_total: 'Motora total', comunicacion_receptiva: 'Receptiva', comunicacion_expresiva: 'Expresiva', comunicacion_total: 'Comunicación total', cognitiva_total: 'Cognitiva total', battelle_total: null,
});
export const EQUIVALENT_AGE_TABLES = Object.freeze({
  personal_social_total: 'N-56 personal_social_total', adaptativa_total: 'N-57 adaptativa_total', motora_gruesa: 'N-58 motora_gruesa', motora_fina: 'N-59 motora_fina', motora_total: 'N-60 motora_total', comunicacion_receptiva: 'N-61 comunicacion_receptiva', comunicacion_expresiva: 'N-62 comunicacion_expresiva', comunicacion_total: 'N-63 comunicacion_total', cognitiva_total: 'N-64 cognitiva_total', battelle_total: 'N-65 battelle_total',
});
export function ageBandForMonths(ageMonths) { return AGE_BANDS.find((b)=>Number.isInteger(ageMonths) && ageMonths >= b.min && ageMonths <= b.max) ?? null; }
function error(code, message, extra = {}) { return { ok: false, error: { code, message, ...extra } }; }
export function percentileScaleNameFor(scaleId) { return PERCENTILE_SCALE_NAMES[scaleId]; }
export function lookupPercentile({ ageMonths, scaleName, directScore, percentileData }) {
  if (directScore === null || directScore === undefined) return error('pd_null', 'La PD no es válida.');
  if (!Number.isFinite(directScore)) return error('pd_invalida', 'La PD no es numérica.');
  const band = ageBandForMonths(ageMonths);
  if (!band || ageMonths > 35) return error('tramo_no_disponible', 'Percentiles pendientes de normalización para este tramo.', { band: band?.label ?? null });
  const tramo = percentileData?.tramos?.find((t)=>t.edad_cronologica_min_meses === band.min && t.edad_cronologica_max_meses === band.max);
  if (!tramo) return error('tramo_no_encontrado', 'No existe tabla de percentiles para el tramo exacto.', { band: band.label });
  const scaleRows = tramo.registros.filter((r)=>r.escala === scaleName);
  if (!scaleRows.length) return error('escala_no_encontrada', 'La escala no existe en la tabla del tramo.', { scaleName, band: band.label });
  const matches = scaleRows.filter((r)=>directScore >= r.puntuacion_directa_min && directScore <= r.puntuacion_directa_max);
  if (matches.length === 0) return error('sin_coincidencia', 'Ningún intervalo contiene la PD.', { scaleName, directScore, band: band.label });
  if (matches.length > 1) return error('coincidencia_multiple', 'Más de un intervalo contiene la PD.', { scaleName, directScore, band: band.label, matches });
  const r = matches[0];
  return { ok: true, percentile: r.percentil, table: r.tabla, page: r.pagina_pdf, confidence: r.confianza, originalValue: { directScore: r.valor_original_pd, percentile: r.valor_original_pc }, band: band.label, scaleName };
}
export function percentileForScale({ ageMonths, scaleId, directScore, percentileData, requiresReview = false }) {
  if (requiresReview) return error('requiere_revision', 'La escala requiere revisión.');
  const scaleName = percentileScaleNameFor(scaleId);
  if (!scaleName) return error('escala_sin_percentil', 'La escala no tiene percentil aplicable en este flujo.', { scaleId });
  return lookupPercentile({ ageMonths, scaleName, directScore, percentileData });
}
export function lookupEquivalentAge({ scaleId, directScore, equivalentAgeData }) {
  if (directScore === null || directScore === undefined) return error('pd_null', 'La PD no es válida.');
  const key = EQUIVALENT_AGE_TABLES[scaleId];
  if (!key) return error('escala_no_permitida', 'La escala no está incluida en el flujo principal de edades equivalentes.', { scaleId });
  const table = equivalentAgeData?.escalas?.[key];
  if (!table) return error('tabla_no_encontrada', 'No existe la tabla de edad equivalente.', { scaleId, key });
  const matches = table.registros.filter((r)=>directScore >= r.puntuacion_min && directScore <= r.puntuacion_max);
  if (!matches.length) return error('sin_coincidencia', 'Ningún intervalo contiene la PD.', { scaleId, directScore, key });
  if (matches.length > 1) return error('coincidencia_multiple', 'Más de un intervalo contiene la PD.', { scaleId, directScore, key, matches });
  const r = matches[0];
  return { ok: true, minMonths: r.edad_equivalente_min_meses, maxMonths: r.edad_equivalente_max_meses, originalValue: { directScore: r.valor_original_puntuacion, age: r.valor_original_edad }, table: table.tabla, page: r.pagina_pdf, confidence: r.confianza, scaleId };
}
export function equivalentAgeForScale(args) { return args.requiresReview ? error('requiere_revision','La escala requiere revisión.') : lookupEquivalentAge(args); }
