export const THERAPIST_MAX_LENGTH = 100;
export const UNASSIGNED_THERAPIST = 'Sin asignar';

export function normalizeForComparison(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-ES');
}

export function sanitizeTherapistName(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > THERAPIST_MAX_LENGTH || /<[^>]*>|[<>]/.test(clean)) return null;
  return clean;
}

export function therapistSuggestions(records = []) {
  const canonical = new Map();
  for (const record of records) {
    const name = sanitizeTherapistName(record?.therapistName);
    const key = normalizeForComparison(name);
    if (name && key && !canonical.has(key)) canonical.set(key, name);
  }
  return [...canonical.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export function canonicalTherapistName(value, records = []) {
  const clean = sanitizeTherapistName(value);
  if (!clean) return null;
  const key = normalizeForComparison(clean);
  return therapistSuggestions(records).find(name => normalizeForComparison(name) === key) ?? clean;
}

export function therapistLabel(value) {
  return sanitizeTherapistName(value) ?? UNASSIGNED_THERAPIST;
}
