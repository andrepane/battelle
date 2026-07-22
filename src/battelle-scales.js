import { loadJson } from './battelle-data.js';
export async function loadScaleModel(path = 'data/modelo_escalas_battelle.json') { return loadJson(path); }
export function subareaKey(area, subarea) { return `${area}|${subarea}`; }
export function itemCodesForScale(scale, items) {
  const allowedAreas = new Set(scale.areas ?? []);
  const allowedSubareas = new Set(scale.subareas ?? []);
  return items.filter((item)=>allowedAreas.has(item.area)||allowedSubareas.has(subareaKey(item.area,item.subarea))).map((i)=>i.codigo_canonico);
}
export function calculateScaleMaximum(scale, items) { return itemCodesForScale(scale, items).length * 2; }
export function validateScaleModel(model, items) {
  const itemSubareas = new Set(items.map((i)=>subareaKey(i.area,i.subarea)));
  const itemAreas = new Set(items.map((i)=>i.area));
  const errors=[];
  for (const [id, scale] of Object.entries(model.escalas)) {
    for (const area of scale.areas ?? []) if (!itemAreas.has(area)) errors.push(`${id}: área inexistente ${area}`);
    for (const subarea of scale.subareas ?? []) if (!itemSubareas.has(subarea)) errors.push(`${id}: subárea inexistente ${subarea}`);
    const codes = itemCodesForScale(scale, items);
    if (new Set(codes).size !== codes.length) errors.push(`${id}: doble conteo interno`);
  }
  const covered = new Set(Object.values(model.escalas).flatMap((s)=>itemCodesForScale(s, items)));
  for (const item of items) if (!covered.has(item.codigo_canonico)) errors.push(`ítem sin escala: ${item.codigo}`);
  if (errors.length) throw new Error(errors.join('\n'));
}
