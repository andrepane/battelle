export const THERAPIST_MAX_LENGTH = 100;
export const UNASSIGNED_THERAPIST = 'Sin asignar';
export const THERAPIST_ROSTER = Object.freeze([
  'Ana Moreno TO', 'Andrea Panepinto LG', 'Berta De Andrés FT', 'Cecilia Pizones PD',
  'Cristina Agúndez TO', 'Cristina Miranda PS', 'Delia García PS', 'Eshter Pascual PS',
  'Estela Monís FT', 'Eva Fernández PS', 'Eva Nofuentes LG', 'Helena Galán LG',
  'Lidia Pérez PS', 'María Alcaide LG', 'María Benito FT', 'Marta García LG',
  'Mónica Pérez PS', 'Nati Narbona PS', 'Pablo Luna TO', 'Sara Gamero TO',
  'Sara Rodríguez AL', 'Shamira Rodríguez LG', 'Teresa Álvarez PS', 'Virginia Sande PS'
]);

const THERAPIST_ALIASES = new Map([
  ['andrea', 'Andrea Panepinto LG'],
  ['maria ft', 'María Benito FT'],
  ['berta', 'Berta De Andrés FT']
]);

export function normalizeForComparison(value) {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-ES');
}

export function sanitizeTherapistName(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const clean = value.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > THERAPIST_MAX_LENGTH || /<[^>]*>|[<>]/.test(clean)) return null;
  return THERAPIST_ALIASES.get(normalizeForComparison(clean)) ?? clean;
}

export function therapistSuggestions(records = []) {
  const canonical = new Map(THERAPIST_ROSTER.map(name => [normalizeForComparison(name), name]));
  for (const record of records) {
    const name = sanitizeTherapistName(record?.therapistName);
    const replacement = THERAPIST_ALIASES.get(normalizeForComparison(name)) ?? name;
    const key = normalizeForComparison(replacement);
    if (replacement && key && !canonical.has(key)) canonical.set(key, replacement);
  }
  return [...canonical.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

export function canonicalTherapistName(value, records = []) {
  const clean = sanitizeTherapistName(value);
  if (!clean) return null;
  const key = normalizeForComparison(clean);
  if (THERAPIST_ALIASES.has(key)) return THERAPIST_ALIASES.get(key);
  return therapistSuggestions(records).find(name => normalizeForComparison(name) === key) ?? clean;
}

export function therapistLabel(value) {
  const clean = sanitizeTherapistName(value);
  return (clean && (THERAPIST_ALIASES.get(normalizeForComparison(clean)) ?? clean)) || UNASSIGNED_THERAPIST;
}
