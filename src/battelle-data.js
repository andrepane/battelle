export const EXPECTED_AREA_COUNTS = Object.freeze({
  'Personal/Social': 85,
  Adaptativa: 59,
  Motora: 82,
  'Comunicación': 59,
  Cognitiva: 56,
});
export const EXPECTED_TOTAL_ITEMS = 341;

export function normalizeItemCode(code) {
  if (typeof code !== 'string') throw new Error(`Código de ítem inválido: ${code}`);
  const match = code.trim().match(/^([A-Z]+)\s*(\d+)$/u);
  if (!match) throw new Error(`Código de ítem no interpretable: ${code}`);
  return `${match[1]}${Number(match[2])}`;
}

export function parseAgeRange(range) {
  if (typeof range !== 'string') throw new Error(`Rango de edad inválido: ${range}`);
  const match = range.trim().match(/^(\d+)\s*-\s*(\d+)$/u);
  if (!match) throw new Error(`Rango de edad no interpretable: ${range}`);
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) {
    throw new Error(`Rango de edad no interpretable: ${range}`);
  }
  return { min, max, etiqueta: `${min}-${max}` };
}

export async function loadJson(pathOrUrl) {
  if (typeof window !== 'undefined' && window.fetch && !String(pathOrUrl).startsWith('file:')) {
    const response = await fetch(pathOrUrl);
    if (!response.ok) throw new Error(`No se pudo cargar ${pathOrUrl}: ${response.status}`);
    return response.json();
  }
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(pathOrUrl, 'utf8');
  return JSON.parse(text);
}

export async function loadAndNormalizeItems(path = 'data/items_areas_subareas.json') {
  return normalizeItemsData(await loadJson(path));
}

export function normalizeItemsData(data) {
  const declaredOrder = new Map();
  const subareaOrder = new Map();
  data.areas.forEach((area, areaIndex) => {
    area.subareas.forEach((subarea, subareaIndex) => {
      subareaOrder.set(`${area.nombre}|${subarea.nombre}`, { orden_area: areaIndex + 1, orden_subarea: subareaIndex + 1 });
      subarea.items.forEach((codigo, itemIndex) => declaredOrder.set(`${area.nombre}|${subarea.nombre}|${normalizeItemCode(codigo)}`, itemIndex + 1));
    });
  });
  const seen = new Set();
  const items = data.items.map((item) => {
    const codigo_canonico = normalizeItemCode(item.codigo);
    if (seen.has(codigo_canonico)) throw new Error(`Código duplicado: ${item.codigo}`);
    seen.add(codigo_canonico);
    const range = parseAgeRange(item.rango_edad_meses);
    const key = `${item.area}|${item.subarea}`;
    const order = subareaOrder.get(key);
    const orden_item = declaredOrder.get(`${key}|${codigo_canonico}`);
    if (!order || !orden_item) throw new Error(`Ítem no declarado en áreas/subáreas: ${item.codigo}`);
    return { codigo: item.codigo, codigo_canonico, area: item.area, subarea: item.subarea,
      rango_edad_min_meses: range.min, rango_edad_max_meses: range.max, rango_edad: range.etiqueta,
      orden_area: order.orden_area, orden_subarea: order.orden_subarea, orden_item,
      enunciado: item.enunciado, confianza: item.confianza };
  }).sort((a,b)=>a.orden_area-b.orden_area||a.orden_subarea-b.orden_subarea||a.orden_item-b.orden_item);
  validateNormalizedItems(items, data);
  return items;
}

export function validateNormalizedItems(items, data = null) {
  if (items.length !== EXPECTED_TOTAL_ITEMS) throw new Error(`Faltan ítems: ${items.length} != ${EXPECTED_TOTAL_ITEMS}`);
  const counts = Object.fromEntries(Object.keys(EXPECTED_AREA_COUNTS).map((k)=>[k,0]));
  const codes = new Set();
  for (const item of items) { counts[item.area] = (counts[item.area] ?? 0) + 1; if (codes.has(item.codigo_canonico)) throw new Error(`Código duplicado: ${item.codigo}`); codes.add(item.codigo_canonico); }
  for (const [area, expected] of Object.entries(EXPECTED_AREA_COUNTS)) if (counts[area] !== expected) throw new Error(`Recuento ${area}: ${counts[area]} != ${expected}`);
  if (data) {
    const declared = new Set(data.areas.flatMap((a)=>a.subareas.flatMap((s)=>s.items.map((c)=>`${a.nombre}|${s.nombre}|${normalizeItemCode(c)}`))));
    const actual = new Set(items.map((i)=>`${i.area}|${i.subarea}|${i.codigo_canonico}`));
    if (declared.size !== actual.size || [...declared].some((k)=>!actual.has(k))) throw new Error('El resumen de áreas/subáreas no corresponde al listado detallado de ítems');
  }
}
