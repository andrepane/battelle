#!/usr/bin/env python3
import json
import sys
from pathlib import Path

EXPECTED = {
    "N-3": {"pagina": 1, "escalas": ["Interacción con el adulto", "Expresión de sentimientos/afecto", "Autoconcepto", "Personal/Social total"]},
    "N-4": {"pagina": 2, "escalas": ["Atención", "Comida", "Adaptativa total"]},
    "N-5": {"pagina": 3, "escalas": ["Control muscular", "Coordinación corporal", "Motricidad fina", "Motora gruesa", "Motora fina", "Motora total"]},
    "N-6": {"pagina": 4, "escalas": ["Receptiva", "Expresiva", "Comunicación total"]},
    "N-7": {"pagina": 5, "escalas": ["Discriminación perceptiva", "Memoria", "Cognitiva total"]},
}

AREA_ALIASES = {
    "Personal/Social": "Personal/Social",
    "Adaptativa": "Adaptativa",
    "Motora": "Motora",
    "Comunicación": "Comunicación",
    "Cognitiva": "Cognitiva",
}

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
            maxima[escala] = {
                "max": sum(maxima[subarea]["max"] for subarea in meta["subareas"]),
                "tipo": "agregado",
                "area": meta["area"],
                "subareas": meta["subareas"],
            }
        else:
            maxima[escala] = {
                "max": maxima[f"{meta['area']} total"]["max"],
                "tipo": "total_area",
                "area": meta["area"],
            }
    return maxima


def main():
    maxima = load_theoretical_maxima()
    data = json.loads(Path("data/percentiles_battelle.json").read_text(encoding="utf-8"))
    registros = []
    for tramo in data.get("tramos", []):
        if tramo.get("edad_cronologica_min_meses") == 0 and tramo.get("edad_cronologica_max_meses") == 5:
            registros.extend(tramo.get("registros", []))
    if not registros:
        return fail("no hay registros para 0-5 meses")
    if any(r.get("valores") == [] for r in registros):
        return fail("hay filas con valores: []")

    errors = []
    tabs = {r.get("tabla") for r in registros}
    if tabs != set(EXPECTED):
        errors.append(f"tablas esperadas {set(EXPECTED)}, encontradas {tabs}")

    by = {}
    for r in registros:
        tab = r.get("tabla")
        esc = r.get("escala")
        if r.get("edad_cronologica_min_meses") != 0 or r.get("edad_cronologica_max_meses") != 5:
            errors.append(f"edad no 0-5: {r}")
        pc = r.get("percentil")
        if not isinstance(pc, int) or not (1 <= pc <= 99):
            errors.append(f"percentil inválido: {r}")
        if tab in EXPECTED and r.get("pagina_pdf") != EXPECTED[tab]["pagina"]:
            errors.append(f"página inválida {tab}/{esc}: {r.get('pagina_pdf')}")
        if tab in EXPECTED and esc not in EXPECTED[tab]["escalas"]:
            errors.append(f"escala no esperada en {tab}: {esc}")
        if esc not in maxima:
            errors.append(f"escala sin máximo teórico calculado desde items: {esc}")
        by.setdefault((tab, esc), []).append(r)

    for tab, meta in EXPECTED.items():
        for esc in meta["escalas"]:
            rs = by.get((tab, esc), [])
            if not rs:
                errors.append(f"falta escala {tab} {esc}")
                continue
            maxpd = maxima[esc]["max"]
            covered = {}
            for r in rs:
                a, b = r["puntuacion_directa_min"], r["puntuacion_directa_max"]
                if not (0 <= a <= b <= maxpd):
                    errors.append(f"intervalo fuera de rango {tab} {esc}: {a}-{b} max {maxpd}")
                if str(r.get("valor_original_pd", "")).endswith("+") and b != maxpd:
                    errors.append(f"límite abierto no llega al máximo teórico {tab} {esc}: {a}-{b} max {maxpd}")
                for pd in range(a, b + 1):
                    if pd in covered:
                        errors.append(f"solapamiento {tab} {esc} PD {pd}")
                    covered[pd] = r
            missing = [pd for pd in range(maxpd + 1) if pd not in covered]
            if missing:
                errors.append(f"huecos {tab} {esc}: {missing[:20]}")
            if len(rs) < 2:
                errors.append(f"posible columna sin separar {tab} {esc}")
    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        return 1
    print(f"OK: {len(registros)} registros validados para N-3 a N-7 (0-5 meses).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
