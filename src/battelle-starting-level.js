function validAge(ageMonths) {
  return Number.isInteger(ageMonths) && ageMonths >= 0;
}

function validRange(item) {
  return Number.isInteger(item?.rango_edad_min_meses)
    && Number.isInteger(item?.rango_edad_max_meses)
    && item.rango_edad_min_meses >= 0
    && item.rango_edad_max_meses >= item.rango_edad_min_meses;
}

/** Both limits are inclusive; overlapping levels use declared order. */
export function startingLevelForAge(items, ageMonths) {
  if (!validAge(ageMonths)) return null;
  const levels = [];
  const seen = new Set();
  for (const item of items ?? []) {
    if (!validRange(item)) continue;
    const key = `${item.rango_edad_min_meses}:${item.rango_edad_max_meses}`;
    if (seen.has(key)) continue;
    seen.add(key);
    levels.push({ min:item.rango_edad_min_meses, max:item.rango_edad_max_meses, key });
  }
  if (!levels.length) return null;
  const contained = levels.find((level)=>ageMonths >= level.min && ageMonths <= level.max);
  if (contained) return contained;
  if (ageMonths < levels[0].min) return levels[0];
  if (ageMonths > levels.at(-1).max) return levels.at(-1);
  return levels.find((level)=>ageMonths < level.min) ?? levels.at(-1);
}

export function itemIsInStartingLevel(item, level) {
  return Boolean(level && item?.rango_edad_min_meses === level.min && item?.rango_edad_max_meses === level.max);
}

export function startingLevelSummary(level) {
  return level ? `Inicio recomendado: ${level.min}–${level.max} meses` : 'Edad necesaria para calcular el inicio';
}
