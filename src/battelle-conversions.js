export const AGE_BANDS = Object.freeze([
  { min: 0, max: 5, label: '0-5' }, { min: 6, max: 11, label: '6-11' },
  { min: 12, max: 17, label: '12-17' }, { min: 18, max: 23, label: '18-23' },
  { min: 24, max: 35, label: '24-35' }, { min: 36, max: 47, label: '36-47' },
  { min: 48, max: 59, label: '48-59' }, { min: 60, max: 71, label: '60-71' },
  { min: 72, max: 83, label: '72-83' }, { min: 84, max: 95, label: '84-95' },
]);
export const PERCENTILE_SCALE_NAMES = Object.freeze({
  personal_social_interaccion_con_el_adulto: 'Interacción con el adulto',
  personal_social_expresion_de_sentimientos_afecto: 'Expresión de sentimientos/afecto',
  personal_social_autoconcepto: 'Autoconcepto',
  personal_social_interaccion_con_los_companeros: 'Interacción con los compañeros',
  personal_social_colaboracion: 'Colaboración', personal_social_rol_social: 'Rol social',
  adaptativa_atencion: 'Atención', adaptativa_comida: 'Comida', adaptativa_vestido: 'Vestido',
  adaptativa_responsabilidad_personal: 'Responsabilidad personal', adaptativa_aseo: 'Aseo',
  motora_control_muscular: 'Control muscular', motora_coordinacion_corporal: 'Coordinación corporal',
  motora_locomocion: 'Locomoción', motora_motricidad_fina: 'Motricidad fina', motora_motricidad_perceptiva: 'Motricidad perceptiva',
  comunicacion_receptiva: 'Receptiva', comunicacion_expresiva: 'Expresiva',
  cognitiva_discriminacion_perceptiva: 'Discriminación perceptiva', cognitiva_memoria: 'Memoria',
  cognitiva_razonamiento_y_habilidades_escolares: 'Razonamiento y habilidades escolares', cognitiva_desarrollo_conceptual: 'Desarrollo conceptual',
  personal_social_total: 'Personal/Social total', adaptativa_total: 'Adaptativa total', motora_gruesa: 'Motora gruesa',
  motora_fina: 'Motora fina', motora_total: 'Motora total', comunicacion_total: 'Comunicación total',
  cognitiva_total: 'Cognitiva total', battelle_total: null,
});
export const EQUIVALENT_AGE_TABLES = Object.freeze({
  personal_social_total: 'N-56 personal_social_total', adaptativa_total: 'N-57 adaptativa_total', motora_gruesa: 'N-58 motora_gruesa', motora_fina: 'N-59 motora_fina', motora_total: 'N-60 motora_total', comunicacion_receptiva: 'N-61 comunicacion_receptiva', comunicacion_expresiva: 'N-62 comunicacion_expresiva', comunicacion_total: 'N-63 comunicacion_total', cognitiva_total: 'N-64 cognitiva_total', battelle_total: 'N-65 battelle_total',
});
export function ageBandForMonths(ageMonths) { return AGE_BANDS.find((b)=>Number.isInteger(ageMonths) && ageMonths >= b.min && ageMonths <= b.max) ?? null; }
function error(code, message, extra = {}) { return { ok: false, error: { code, message, ...extra } }; }
export function validateDirectScore(directScore, max = null) {
  if (typeof directScore !== 'number' || !Number.isFinite(directScore) || !Number.isInteger(directScore) || directScore < 0) return error('pd_invalida', 'La PD debe ser un número entero finito mayor o igual que cero.', { directScore });
  if (Number.isInteger(max) && directScore > max) return error('pd_invalida', 'La PD supera el máximo aplicable.', { directScore, max });
  return { ok: true };
}
export function validatePercentileMappings(model, percentileData) {
  const declared = new Set([...Object.keys(model.subareas ?? {}), ...Object.keys(model.escalas ?? {})]);
  const mapped = new Set(Object.keys(PERCENTILE_SCALE_NAMES));
  const names = new Set((percentileData?.tramos ?? []).flatMap((t)=>t.registros.map((r)=>r.escala)));
  const errors = [];
  for (const id of Object.keys(model.subareas ?? {})) if (!mapped.has(id)) errors.push(`Falta mapeo de percentil para subárea ${id}`);
  for (const id of mapped) if (!declared.has(id)) errors.push(`Mapeo de percentil para id desconocido ${id}`);
  for (const [id, name] of Object.entries(PERCENTILE_SCALE_NAMES)) if (id !== 'battelle_total' && name && !names.has(name)) errors.push(`Nombre de percentil no encontrado para ${id}: ${name}`);
  if (PERCENTILE_SCALE_NAMES.battelle_total !== null) errors.push('Battelle total no debe tener percentil propio.');
  if (errors.length) throw new Error(errors.join('\n'));
}
export function percentileScaleNameFor(scaleId) { return PERCENTILE_SCALE_NAMES[scaleId]; }
export function lookupPercentile({ ageMonths, scaleName, directScore, percentileData, maxScore = null }) {
  const valid = validateDirectScore(directScore, maxScore); if (!valid.ok) return valid;
  const band = ageBandForMonths(ageMonths);
  if (!band || ageMonths > 35) return error('tramo_no_disponible', 'Percentiles pendientes de normalización para este tramo.', { band: band?.label ?? null });
  const tramo = percentileData?.tramos?.find((t)=>t.edad_cronologica_min_meses === band.min && t.edad_cronologica_max_meses === band.max);
  if (!tramo) return error('tramo_no_encontrado', 'No existe tabla de percentiles para el tramo exacto.', { band: band.label });
  const scaleRows = tramo.registros.filter((r)=>r.escala === scaleName);
  if (!scaleRows.length) return error('escala_no_encontrada', 'Escala no incluida en este tramo.', { scaleName, band: band.label });
  const matches = scaleRows.filter((r)=>directScore >= r.puntuacion_directa_min && directScore <= r.puntuacion_directa_max);
  if (matches.length === 0) return error('sin_coincidencia', 'Ningún intervalo contiene la PD.', { scaleName, directScore, band: band.label });
  if (matches.length > 1) return error('coincidencia_multiple', 'Más de un intervalo contiene la PD.', { scaleName, directScore, band: band.label, matches });
  const r = matches[0];
  return { ok: true, percentile: r.percentil, table: r.tabla, page: r.pagina_pdf, confidence: r.confianza, originalValue: { directScore: r.valor_original_pd, percentile: r.valor_original_pc }, band: band.label, scaleName };
}
export function percentileForScale({ ageMonths, scaleId, directScore, percentileData, requiresReview = false, maxScore = null }) {
  if (requiresReview) return error('requiere_revision', 'La escala requiere revisión.');
  const scaleName = percentileScaleNameFor(scaleId);
  if (!Object.hasOwn(PERCENTILE_SCALE_NAMES, scaleId) || !scaleName) return error('escala_sin_percentil', 'La escala no tiene percentil aplicable en este flujo.', { scaleId });
  return lookupPercentile({ ageMonths, scaleName, directScore, percentileData, maxScore });
}
export function lookupEquivalentAge({ scaleId, directScore, equivalentAgeData, maxScore = null }) {
  const valid = validateDirectScore(directScore, maxScore); if (!valid.ok) return valid;
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
