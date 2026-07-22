#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path

EXPECTED = {
    (0, 5): {
        "N-3": {"pagina": 1, "escalas": ["Interacción con el adulto", "Expresión de sentimientos/afecto", "Autoconcepto", "Personal/Social total"]},
        "N-4": {"pagina": 2, "escalas": ["Atención", "Comida", "Adaptativa total"]},
        "N-5": {"pagina": 3, "escalas": ["Control muscular", "Coordinación corporal", "Motricidad fina", "Motora gruesa", "Motora fina", "Motora total"]},
        "N-6": {"pagina": 4, "escalas": ["Receptiva", "Expresiva", "Comunicación total"]},
        "N-7": {"pagina": 5, "escalas": ["Discriminación perceptiva", "Memoria", "Cognitiva total"]},
    },
    (6, 11): {
        "N-8": {"pagina": 5, "escalas": ["Interacción con el adulto", "Expresión de sentimientos/afecto", "Autoconcepto", "Personal/Social total"]},
        "N-9": {"pagina": 6, "escalas": ["Atención", "Comida", "Adaptativa total"]},
        "N-10": {"pagina": 7, "escalas": ["Control muscular", "Coordinación corporal", "Locomoción", "Motricidad fina", "Motora gruesa", "Motora fina", "Motora total"]},
        "N-11": {"pagina": 8, "escalas": ["Receptiva", "Expresiva", "Comunicación total"]},
        "N-12": {"pagina": 9, "escalas": ["Discriminación perceptiva", "Memoria", "Razonamiento y habilidades escolares", "Cognitiva total"]},
    },
}

VALIDATED_0_5_SHA256 = "58eb37230c046640e0c44b001ac5be1283d5426c620be638229dfafcf630b17c"

AREA_ALIASES = {"Personal/Social": "Personal/Social", "Adaptativa": "Adaptativa", "Motora": "Motora", "Comunicación": "Comunicación", "Cognitiva": "Cognitiva"}
AGGREGATES = {
    "Personal/Social total": {"tipo": "total_area", "area": "Personal/Social"},
    "Adaptativa total": {"tipo": "total_area", "area": "Adaptativa"},
    "Motora gruesa": {"tipo": "agregado", "area": "Motora", "subareas": ["Control muscular", "Coordinación corporal", "Locomoción"]},
    "Motora fina": {"tipo": "agregado", "area": "Motora", "subareas": ["Motricidad fina", "Motricidad perceptiva"]},
    "Motora total": {"tipo": "total_area", "area": "Motora"},
    "Comunicación total": {"tipo": "total_area", "area": "Comunicación"},
    "Cognitiva total": {"tipo": "total_area", "area": "Cognitiva"},
}


def fail(msg):
    print(f"ERROR: {msg}", file=sys.stderr)
    return 1


def load_theoretical_maxima():
    items = json.loads(Path("data/items_areas_subareas.json").read_text(encoding="utf-8"))
    maxima = {}
    for area in items["areas"]:
        area_name = AREA_ALIASES.get(area["nombre"], area["nombre"])
        total_items = 0
        for subarea in area["subareas"]:
            max_pd = len(subarea["items"]) * 2
            maxima[subarea["nombre"]] = {"max": max_pd, "tipo": "subarea", "area": area_name}
            total_items += len(subarea["items"])
        maxima[f"{area_name} total"] = {"max": total_items * 2, "tipo": "total_area", "area": area_name}
    for escala, meta in AGGREGATES.items():
        if meta["tipo"] == "agregado":
            maxima[escala] = {"max": sum(maxima[subarea]["max"] for subarea in meta["subareas"]), "tipo": "agregado", "area": meta["area"], "subareas": meta["subareas"]}
        else:
            maxima[escala] = {"max": maxima[f"{meta['area']} total"]["max"], "tipo": "total_area", "area": meta["area"]}
    return maxima


def inventario_pages():
    inv = json.loads(Path("data/inventario_tablas.json").read_text(encoding="utf-8"))["inventario"]
    return {e["numero_oficial"]: e["pagina_pdf"] for e in inv if e.get("numero_oficial")}


def validate_group(errors, tramo_key, registros, expected, maxima, pages):
    by = {}
    min_m, max_m = tramo_key
    tabs = {r.get("tabla") for r in registros}
    if tabs != set(expected):
        errors.append(f"tramo {min_m}-{max_m}: tablas esperadas {set(expected)}, encontradas {tabs}")
    for r in registros:
        tab, esc = r.get("tabla"), r.get("escala")
        if r.get("edad_cronologica_min_meses") != min_m or r.get("edad_cronologica_max_meses") != max_m:
            errors.append(f"tramo {min_m}-{max_m}: registro con edad ajena: {r}")
        pc = r.get("percentil")
        if not isinstance(pc, int) or not (1 <= pc <= 99):
            errors.append(f"percentil inválido: {r}")
        if min_m == 6:
            if r.get("auditoria_visual_completa") is not True:
                errors.append(f"auditoría visual incompleta {tab}/{esc}")
            if r.get("filas_transcritas") != r.get("filas_visibles_esperadas"):
                errors.append(f"filas transcritas no coinciden {tab}/{esc}: {r.get('filas_transcritas')} != {r.get('filas_visibles_esperadas')}")
            if r.get("confianza") == "baja":
                errors.append(f"confianza baja no apta para uso clínico {tab}/{esc}")
        if tab in expected and r.get("pagina_pdf") != expected[tab]["pagina"]:
            errors.append(f"página inválida {tab}/{esc}: {r.get('pagina_pdf')}")
        if tab in pages and r.get("pagina_pdf") != pages[tab]:
            errors.append(f"página no coincide con inventario {tab}/{esc}: {r.get('pagina_pdf')} != {pages[tab]}")
        if tab in expected and esc not in expected[tab]["escalas"]:
            errors.append(f"escala no esperada en {tab}: {esc}")
        if esc not in maxima:
            errors.append(f"escala sin máximo teórico calculado desde items: {esc}")
        by.setdefault((tab, esc), []).append(r)
    for tab, meta in expected.items():
        if [r.get("escala") for r in registros if r.get("tabla") == tab][: len(meta["escalas"])] == []:
            errors.append(f"sin registros en {tab}")
        for esc in meta["escalas"]:
            rs = by.get((tab, esc), [])
            if not rs:
                errors.append(f"falta escala {tab} {esc}")
                continue
            if tramo_key == (6, 11):
                visibles = {r.get("filas_visibles_esperadas") for r in rs}
                transcritas = {r.get("filas_transcritas") for r in rs}
                if visibles != {len(rs)} or transcritas != {len(rs)}:
                    errors.append(f"recuento visual incoherente {tab} {esc}: visibles={visibles}, transcritas={transcritas}, registros={len(rs)}")
            maxpd = maxima[esc]["max"]
            covered = {}
            for r in rs:
                a, b = r["puntuacion_directa_min"], r["puntuacion_directa_max"]
                if not (0 <= a <= b <= maxpd):
                    errors.append(f"intervalo fuera de rango {tab} {esc}: {a}-{b} max {maxpd}")
                if str(r.get("valor_original_pd", "")).endswith("+") and b != maxpd:
                    errors.append(f"límite abierto no llega al máximo teórico {tab} {esc}: {a}-{b} max {maxpd}")
                for score in range(a, b + 1):
                    if score in covered:
                        errors.append(f"solapamiento {tab} {esc} PD {score}")
                    covered[score] = r
            missing = [score for score in range(maxpd + 1) if score not in covered]
            if missing:
                errors.append(f"huecos {tab} {esc}: {missing[:20]}")
            if len(rs) < 2:
                errors.append(f"posible columna sin separar {tab} {esc}")


def validate_dudosas(errors, data):
    registros = data.get("tramos", [])
    flat = [r for tramo in registros for r in tramo.get("registros", [])]
    for duda in data.get("celdas_dudosas", []):
        tab = duda.get("tabla")
        if tab not in {"N-8", "N-9", "N-10", "N-11", "N-12"}:
            continue
        matches = [r for r in flat if r.get("tabla") == tab and (not duda.get("escala") or r.get("escala") == duda.get("escala")) and (not duda.get("valor_original_pd") or r.get("valor_original_pd") == duda.get("valor_original_pd"))]
        if not matches:
            errors.append(f"celda dudosa sin registro correspondiente: {duda}")


def main():
    maxima = load_theoretical_maxima()
    pages = inventario_pages()
    data = json.loads(Path("data/percentiles_battelle.json").read_text(encoding="utf-8"))
    tramos = {(t.get("edad_cronologica_min_meses"), t.get("edad_cronologica_max_meses")): t for t in data.get("tramos", [])}
    errors = []
    if hashlib.sha256(json.dumps(tramos.get((0, 5), {}), sort_keys=True, ensure_ascii=False).encode()).hexdigest() != VALIDATED_0_5_SHA256:
        errors.append("el bloque validado 0-5 fue modificado")
    validate_dudosas(errors, data)
    for tramo_key, expected in EXPECTED.items():
        tramo = tramos.get(tramo_key)
        if not tramo:
            errors.append(f"falta tramo {tramo_key[0]}-{tramo_key[1]}")
            continue
        registros = tramo.get("registros", [])
        if any(r.get("valores") == [] for r in registros):
            errors.append(f"tramo {tramo_key[0]}-{tramo_key[1]} contiene filas con valores: []")
        validate_group(errors, tramo_key, registros, expected, maxima, pages)
    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        return 1
    total = sum(len(tramos[k].get("registros", [])) for k in EXPECTED)
    print(f"OK: {total} registros validados para N-3 a N-12 (0-5 y 6-11 meses).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
