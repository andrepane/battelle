export const NORMATIVE_PENDING_MESSAGE = 'Baremos pendientes de incorporar desde las nuevas fuentes estructuradas.';
export const AGE_BANDS = Object.freeze([
  { min: 0, max: 5, label: '0-5' }, { min: 6, max: 11, label: '6-11' },
  { min: 12, max: 17, label: '12-17' }, { min: 18, max: 23, label: '18-23' },
  { min: 24, max: 35, label: '24-35' }, { min: 36, max: 47, label: '36-47' },
  { min: 48, max: 59, label: '48-59' }, { min: 60, max: 71, label: '60-71' },
  { min: 72, max: 83, label: '72-83' }, { min: 84, max: 95, label: '84-95' },
]);
function error(code, message, extra = {}) { return { ok: false, error: { code, message, ...extra } }; }
export function ageBandForMonths(ageMonths) { return AGE_BANDS.find((b)=>Number.isInteger(ageMonths) && ageMonths >= b.min && ageMonths <= b.max) ?? null; }
export function validateDirectScore(directScore, max = null) {
  if (typeof directScore !== 'number' || !Number.isFinite(directScore) || !Number.isInteger(directScore) || directScore < 0) return error('pd_invalida', 'La PD debe ser un número entero finito mayor o igual que cero.', { directScore });
  if (Number.isInteger(max) && directScore > max) return error('pd_invalida', 'La PD supera el máximo aplicable.', { directScore, max });
  return { ok: true };
}
export function pendingNormativeResult(kind, extra = {}) { return error('baremos_pendientes', NORMATIVE_PENDING_MESSAGE, { kind, ...extra }); }
export function validatePercentileMappings() { return { ok: true, status: 'baremos_pendientes', message: NORMATIVE_PENDING_MESSAGE }; }
export function percentileScaleNameFor(scaleId) { return scaleId; }
export function lookupPercentile({ ageMonths, scaleName, directScore, maxScore = null }) {
  const valid = validateDirectScore(directScore, maxScore); if (!valid.ok) return valid;
  return pendingNormativeResult('percentil', { band: ageBandForMonths(ageMonths)?.label ?? null, scaleName });
}
export function percentileForScale({ ageMonths, scaleId, directScore, requiresReview = false, maxScore = null }) {
  const valid = validateDirectScore(directScore, maxScore); if (!valid.ok) return valid;
  if (requiresReview) return error('requiere_revision', 'La escala requiere revisión.');
  return pendingNormativeResult('percentil', { band: ageBandForMonths(ageMonths)?.label ?? null, scaleId });
}
export function lookupEquivalentAge({ scaleId, directScore, maxScore = null }) {
  const valid = validateDirectScore(directScore, maxScore); if (!valid.ok) return valid;
  return pendingNormativeResult('edad_equivalente', { scaleId });
}
export function equivalentAgeForScale(args) { return args.requiresReview ? error('requiere_revision','La escala requiere revisión.') : lookupEquivalentAge(args); }
