import { loadJson } from './battelle-data.js';

export async function loadScaleModel(path = 'data/modelo_escalas_battelle.json') { return loadJson(path); }
export function subareaKey(area, subarea) { return `${area}|${subarea}`; }
export function subareaModelKey(definition) { return subareaKey(definition.area, definition.subarea); }

export function itemCodesForSubarea(subareaDefinition, items) {
  return items.filter((item)=>item.area === subareaDefinition.area && item.subarea === subareaDefinition.subarea).map((i)=>i.codigo_canonico);
}

export function itemCodesForScale(scale, items, model = null) {
  const allowedAreas = new Set(scale.areas ?? []);
  const allowedSubareas = new Set(scale.subareas ?? []);
  if (model && scale.subarea_ids) {
    for (const id of scale.subarea_ids) {
      const definition = model.subareas[id];
      if (definition) allowedSubareas.add(subareaModelKey(definition));
    }
  }
  return items.filter((item)=>allowedAreas.has(item.area)||allowedSubareas.has(subareaKey(item.area,item.subarea))).map((i)=>i.codigo_canonico);
}

export function calculateScaleMaximum(scale, items, model = null) { return itemCodesForScale(scale, items, model).length * 2; }

export function declaredSubareaEntries(model) {
  return Object.entries(model.subareas ?? {}).map(([id, definition]) => [id, { ...definition, clave: subareaModelKey(definition) }]);
}

export function validateScaleModel(model, items) {
  const itemSubareas = new Set(items.map((i)=>subareaKey(i.area,i.subarea)));
  const itemAreas = new Set(items.map((i)=>i.area));
  const errors=[];
  const declared = declaredSubareaEntries(model);
  const declaredKeys = declared.map(([, definition])=>definition.clave);
  const declaredCounts = new Map();
  for (const key of declaredKeys) declaredCounts.set(key, (declaredCounts.get(key) ?? 0) + 1);
  for (const key of itemSubareas) if ((declaredCounts.get(key) ?? 0) !== 1) errors.push(`subárea documental no declarada exactamente una vez: ${key}`);
  for (const [id, definition] of declared) {
    if (!itemAreas.has(definition.area)) errors.push(`${id}: área inventada ${definition.area}`);
    if (!itemSubareas.has(definition.clave)) errors.push(`${id}: subárea inventada ${definition.clave}`);
    const codes = itemCodesForSubarea(definition, items);
    if (codes.length === 0) errors.push(`${id}: subárea sin ítems`);
    const foreign = items.filter((item)=>codes.includes(item.codigo_canonico) && (item.area !== definition.area || item.subarea !== definition.subarea));
    if (foreign.length) errors.push(`${id}: contiene ítems de otra subárea`);
  }
  const subareaUnion = declared.flatMap(([, definition])=>itemCodesForSubarea(definition, items));
  if (subareaUnion.length !== 341 || new Set(subareaUnion).size !== 341) errors.push(`unión de subáreas inválida: ${subareaUnion.length} entradas, ${new Set(subareaUnion).size} únicas`);
  for (const [id, scale] of Object.entries(model.escalas ?? {})) {
    for (const area of scale.areas ?? []) if (!itemAreas.has(area)) errors.push(`${id}: área inexistente ${area}`);
    for (const subarea of scale.subareas ?? []) if (!itemSubareas.has(subarea)) errors.push(`${id}: subárea inexistente ${subarea}`);
    for (const subareaId of scale.subarea_ids ?? []) if (!model.subareas?.[subareaId]) errors.push(`${id}: subarea_id inexistente ${subareaId}`);
    const codes = itemCodesForScale(scale, items, model);
    if (new Set(codes).size !== codes.length) errors.push(`${id}: doble conteo interno`);
  }
  const coveredBySubareas = new Set(subareaUnion);
  for (const item of items) if (!coveredBySubareas.has(item.codigo_canonico)) errors.push(`ítem sin subárea declarada: ${item.codigo}`);
  if (errors.length) throw new Error(errors.join('\n'));
}
