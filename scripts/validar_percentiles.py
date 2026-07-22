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
    (12, 17): {
        "N-13": {"pagina": 10, "escalas": ["Interacción con el adulto", "Expresión de sentimientos/afecto", "Autoconcepto", "Interacción con los compañeros", "Personal/Social total"]},
        "N-14": {"pagina": 11, "escalas": ["Atención", "Comida", "Vestido", "Adaptativa total"]},
        "N-15": {"pagina": 12, "escalas": ["Coordinación corporal", "Locomoción", "Motricidad fina", "Motricidad perceptiva", "Motora gruesa", "Motora fina", "Motora total"]},
        "N-16": {"pagina": 13, "escalas": ["Receptiva", "Expresiva", "Comunicación total"]},
        "N-17": {"pagina": 13, "escalas": ["Discriminación perceptiva", "Memoria", "Razonamiento y habilidades escolares", "Desarrollo conceptual", "Cognitiva total"]},
    },
    (18, 23): {
        "N-18": {"pagina": 14, "escalas": ["Interacción con el adulto", "Expresión de sentimientos/afecto", "Autoconcepto", "Interacción con los compañeros", "Colaboración", "Personal/Social total"]},
        "N-19": {"pagina": 15, "escalas": ["Atención", "Comida", "Vestido", "Responsabilidad personal", "Adaptativa total"]},
        "N-20": {"pagina": 16, "escalas": ["Coordinación corporal", "Locomoción", "Motricidad fina", "Motricidad perceptiva", "Motora gruesa", "Motora fina", "Motora total"]},
        "N-21": {"pagina": 17, "escalas": ["Receptiva", "Expresiva", "Comunicación total"]},
        "N-22": {"pagina": 17, "escalas": ["Discriminación perceptiva", "Memoria", "Razonamiento y habilidades escolares", "Desarrollo conceptual", "Cognitiva total"]},
    },
    (24, 35): {
        "N-23": {"pagina": 18, "escalas": ["Interacción con el adulto", "Expresión de sentimientos/afecto", "Autoconcepto", "Interacción con los compañeros", "Colaboración", "Rol social", "Personal/Social total"]},
        "N-24": {"pagina": 19, "escalas": ["Atención", "Comida", "Vestido", "Responsabilidad personal", "Aseo", "Adaptativa total"]},
        "N-25": {"pagina": 20, "escalas": ["Coordinación corporal", "Locomoción", "Motricidad fina", "Motricidad perceptiva", "Motora gruesa", "Motora fina", "Motora total"]},
        "N-26": {"pagina": 21, "escalas": ["Receptiva", "Expresiva", "Comunicación total"]},
        "N-27": {"pagina": 21, "escalas": ["Discriminación perceptiva", "Memoria", "Razonamiento y habilidades escolares", "Desarrollo conceptual", "Cognitiva total"]},
    },
}

VALIDATED_0_5_SHA256 = "58eb37230c046640e0c44b001ac5be1283d5426c620be638229dfafcf630b17c"
VALIDATED_6_11_SHA256 = "683b6f8459ad384873ca3ad2a4d54d0f5c4c4a52f69631cbb6065836e8cf7ae7"
VALIDATED_12_17_SHA256 = "fb756b48fb08a06adb71a1bdd2c5781742d9f417e11cd03528c50bb3dae9d1ce"
VALIDATED_18_23_SHA256 = "cfd9ed575788a33efb9bafbc3443aff301f48e8bd37d3e61e77fd5df7778d567"
MANIFEST_PATHS = {
    (12, 17): Path("data/auditorias/percentiles_12_17_manifest.json"),
    (18, 23): Path("data/auditorias/percentiles_18_23_manifest.json"),
    (24, 35): Path("data/auditorias/percentiles_24_35_manifest.json"),
}
EXPECTED_RECORD_COUNTS = {
    (12, 17): 299,
    (18, 23): 300,
    (24, 35): 510,
}
EXPECTED_SCALE_COUNTS = {
    (12, 17): 24,
    (18, 23): 26,
    (24, 35): 28,
}
EXPECTED_TOTAL_RECORDS = 1568
PDF_SOURCE = Path("Battelle_Tablas de corrección.pdf")

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


def object_bodies(pdf_bytes):
    import re

    pattern = re.compile(rb"(\d+)\s+0\s+obj(.*?)endobj", re.S)
    return {int(match.group(1)): match.group(2) for match in pattern.finditer(pdf_bytes)}


def indirect_object(body, key):
    import re

    match = re.search(rb"/" + key.encode() + rb"\s+(\d+)\s+0\s+R", body)
    return int(match.group(1)) if match else None


def page_tree_order(bodies):
    import re

    root = next(obj for obj, body in bodies.items() if b"/Type/Pages" in body and b"/Parent" not in body)
    ordered = []

    def kids(body):
        match = re.search(rb"/Kids\s*\[(.*?)\]", body, re.S)
        if not match:
            return []
        return [int(obj) for obj in re.findall(rb"(\d+)\s+0\s+R", match.group(1))]

    def walk(obj):
        body = bodies[obj]
        if re.search(rb"/Type\s*/Page\b", body) and not re.search(rb"/Type\s*/Pages\b", body):
            ordered.append(obj)
            return
        for child in kids(body):
            walk(child)

    walk(root)
    return ordered


def manifest_by_scale(errors, data, tramo_key):
    manifest_path = MANIFEST_PATHS[tramo_key]
    if not manifest_path.exists():
        errors.append(f"falta manifiesto de auditoría visual: {manifest_path}")
        return {}, {}
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    fuentes = json.loads(Path("data/fuentes.json").read_text(encoding="utf-8"))
    expected_pdf_sha = next((entry["sha256"] for entry in fuentes["pdfs_found"] if entry["file"] == str(PDF_SOURCE)), None)
    pdf_bytes = PDF_SOURCE.read_bytes()
    actual_pdf_sha = hashlib.sha256(pdf_bytes).hexdigest()
    if manifest.get("sha256_pdf_fuente") != expected_pdf_sha or actual_pdf_sha != expected_pdf_sha:
        errors.append("sha256 del PDF fuente no coincide entre manifiesto, data/fuentes.json y archivo local")
    bodies = object_bodies(pdf_bytes)
    ordered_pages = page_tree_order(bodies)
    table_entries = manifest.get("tablas", [])
    expected_tables = set(EXPECTED[tramo_key])
    if {entry.get("tabla") for entry in table_entries} != expected_tables:
        errors.append(f"el manifiesto no contiene exactamente {sorted(expected_tables)}")
    if any("registros_json" in scale for entry in table_entries for scale in entry.get("escalas_visibles", [])):
        errors.append("el manifiesto no debe contener registros_json copiados; el validador los calcula desde percentiles_battelle.json")
    tramo_data = next((t for t in data.get("tramos", []) if (t.get("edad_cronologica_min_meses"), t.get("edad_cronologica_max_meses")) == tramo_key), {})
    record_counts = {}
    for record in tramo_data.get("registros", []):
        key = (record.get("tabla"), record.get("escala"))
        record_counts[key] = record_counts.get(key, 0) + 1
    manifest_tables = {}
    manifest_scales = {}
    total_records = 0
    total_scales = 0
    image_pages = {}
    for entry in table_entries:
        tab = entry.get("tabla")
        manifest_tables[tab] = entry
        required = ["pagina_pdf_indice_cero", "pagina_pdf_numero_humano", "titulo_visible_confirmado", "objeto_pdf_pagina", "objeto_imagen", "sha256_flujo_imagen", "sha256_pdf_fuente", "metodo_recuento_filas"]
        for field in required:
            if entry.get(field) in (None, ""):
                errors.append(f"manifiesto sin {field} para {tab}")
        if entry.get("titulo_visible_estado") != "confirmado_en_pagina_auditada":
            errors.append(f"título visible no confirmado en manifiesto {tab}")
        if entry.get("estado_cotejo") != "validado_contra_registros_json":
            errors.append(f"estado_cotejo inválido en manifiesto {tab}: {entry.get('estado_cotejo')}")
        page_zero = entry.get("pagina_pdf_indice_cero")
        if not isinstance(page_zero, int) or page_zero < 0 or page_zero >= len(ordered_pages) or ordered_pages[page_zero] != entry.get("objeto_pdf_pagina"):
            errors.append(f"página no coincide con el orden real del árbol /Pages para {tab}")
        if entry.get("pagina_pdf_numero_humano") != page_zero + 1:
            errors.append(f"pagina_pdf_numero_humano inválida para {tab}")
        if entry.get("pagina_inventario") != entry.get("pagina_pdf_numero_humano"):
            errors.append(f"inventario y manifiesto difieren en página para {tab}: {entry.get('pagina_inventario')} != {entry.get('pagina_pdf_numero_humano')}")
        page_body = bodies.get(entry.get("objeto_pdf_pagina"), b"")
        resources_obj = indirect_object(page_body, "Resources") if page_body else None
        resources_body = bodies.get(resources_obj, b"") if resources_obj else b""
        image_obj = entry.get("objeto_imagen")
        if not resources_body or f"/background_Page_0 {image_obj} 0 R".encode() not in resources_body:
            errors.append(f"imagen no vinculada a la página PDF en manifiesto {tab}: página={entry.get('objeto_pdf_pagina')} imagen={image_obj}")
        image_pages.setdefault(image_obj, set()).add(page_zero)
        image_body = bodies.get(image_obj, b"")
        if b"stream" in image_body:
            start = image_body.find(b"stream")
            start = image_body.find(b"\n", start) + 1
            end = image_body.rfind(b"endstream")
            image_stream = image_body[start:end].rstrip(b"\r\n")
            if hashlib.sha256(image_stream).hexdigest() != entry.get("sha256_flujo_imagen"):
                errors.append(f"sha256 de flujo de imagen no coincide para {tab}")
        for scale in entry.get("escalas_visibles", []):
            key = (tab, scale.get("escala"))
            manifest_scales[key] = scale
            total_scales += 1
            independent_rows = scale.get("filas_visibles_independientes")
            if not isinstance(independent_rows, int) or independent_rows <= 0:
                errors.append(f"faltan filas independientes en manifiesto {tab}/{scale.get('escala')}")
                continue
            records = record_counts.get(key, 0)
            total_records += records
            if independent_rows != records:
                errors.append(f"filas visuales independientes y registros JSON difieren {tab}/{scale.get('escala')}: {independent_rows} != {records}")
    for image_obj, pages in image_pages.items():
        if len(pages) > 1:
            errors.append(f"dos tablas de páginas distintas comparten imagen {image_obj}: páginas {sorted(pages)}")
    expected_scales = EXPECTED_SCALE_COUNTS.get(tramo_key, sum(len(v["escalas"]) for v in EXPECTED[tramo_key].values()))
    declared_scales = sum(len(v["escalas"]) for v in EXPECTED[tramo_key].values())
    if declared_scales != expected_scales:
        errors.append(f"la expectativa independiente de escalas para {tramo_key[0]}-{tramo_key[1]} es {expected_scales}; EXPECTED declara {declared_scales}")
    if total_scales != expected_scales:
        errors.append(f"el manifiesto debe cotejar {expected_scales} escalas; tiene {total_scales}")
    expected_records = EXPECTED_RECORD_COUNTS.get(tramo_key)
    if expected_records is not None and total_records != expected_records:
        errors.append(f"el manifiesto debe cotejar {expected_records} registros para {tramo_key[0]}-{tramo_key[1]}; tiene {total_records}")
    return manifest_tables, manifest_scales


def validate_table_audit_metadata(errors, tramo_key, tramo, expected, manifest_tables, manifest_scales):
    min_m, max_m = tramo_key
    if min_m < 12:
        return
    metas = tramo.get("tablas", [])
    by_scale = {(m.get("tabla"), m.get("escala")): m for m in metas}
    for tab, meta in expected.items():
        for escala in meta["escalas"]:
            audit = by_scale.get((tab, escala))
            label = f"{tab}/{escala}"
            if not audit:
                errors.append(f"tramo {min_m}-{max_m}: falta metadato de auditoría para {label}")
                continue
            if audit.get("estado") != "normalizada":
                errors.append(f"tramo {min_m}-{max_m}: escala no normalizada en metadatos {label}: {audit.get('estado')}")
            if audit.get("pagina_pdf") != meta["pagina"]:
                errors.append(f"tramo {min_m}-{max_m}: página de auditoría inválida {label}: {audit.get('pagina_pdf')}")
            if audit.get("auditoria_visual_completa") is not True:
                errors.append(f"tramo {min_m}-{max_m}: auditoría visual incompleta en metadatos {label}")
            manifest_scale = manifest_scales.get((tab, escala))
            if not manifest_scale:
                errors.append(f"tramo {min_m}-{max_m}: falta escala en manifiesto {label}")
            elif audit.get("filas_transcritas") != manifest_scale.get("filas_visibles_independientes"):
                errors.append(f"tramo {min_m}-{max_m}: filas transcritas no coinciden con manifiesto {label}: {audit.get('filas_transcritas')} != {manifest_scale.get('filas_visibles_independientes')}")
            if audit.get("filas_visibles_esperadas") != audit.get("filas_transcritas"):
                errors.append(f"tramo {min_m}-{max_m}: filas visibles/transcritas no coinciden en metadatos {label}: {audit.get('filas_visibles_esperadas')} != {audit.get('filas_transcritas')}")
            if audit.get("confianza") == "baja":
                errors.append(f"tramo {min_m}-{max_m}: confianza baja en metadatos {label}")


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
        if min_m >= 6:
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
            if min_m >= 6:
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
    if hashlib.sha256(json.dumps(tramos.get((6, 11), {}), sort_keys=True, ensure_ascii=False).encode()).hexdigest() != VALIDATED_6_11_SHA256:
        errors.append("el bloque validado 6-11 fue modificado")
    if hashlib.sha256(json.dumps(tramos.get((12, 17), {}), sort_keys=True, ensure_ascii=False).encode()).hexdigest() != VALIDATED_12_17_SHA256:
        errors.append("el bloque validado 12-17 fue modificado")
    if hashlib.sha256(json.dumps(tramos.get((18, 23), {}), sort_keys=True, ensure_ascii=False).encode()).hexdigest() != VALIDATED_18_23_SHA256:
        errors.append("el bloque validado 18-23 fue modificado")
    validate_dudosas(errors, data)
    for tramo_key, expected in EXPECTED.items():
        tramo = tramos.get(tramo_key)
        if not tramo:
            errors.append(f"falta tramo {tramo_key[0]}-{tramo_key[1]}")
            continue
        registros = tramo.get("registros", [])
        expected_count = EXPECTED_RECORD_COUNTS.get(tramo_key)
        if expected_count is not None and len(registros) != expected_count:
            errors.append(f"tramo {tramo_key[0]}-{tramo_key[1]} debe contener {expected_count} registros; tiene {len(registros)}")
        if any(r.get("valores") == [] for r in registros):
            errors.append(f"tramo {tramo_key[0]}-{tramo_key[1]} contiene filas con valores: []")
        manifest_tables, manifest_scales = ({}, {})
        if tramo_key in MANIFEST_PATHS:
            manifest_tables, manifest_scales = manifest_by_scale(errors, data, tramo_key)
        validate_table_audit_metadata(errors, tramo_key, tramo, expected, manifest_tables, manifest_scales)
        validate_group(errors, tramo_key, registros, expected, maxima, pages)
    if errors:
        for e in errors:
            print("ERROR:", e, file=sys.stderr)
        return 1
    total = sum(len(tramos[k].get("registros", [])) for k in EXPECTED)
    if total != EXPECTED_TOTAL_RECORDS:
        print(f"ERROR: total N-3..N-27 debe contener exactamente {EXPECTED_TOTAL_RECORDS} registros; tiene {total}", file=sys.stderr)
        return 1
    print("OK: 12-17 meses: 24 escalas, 299 registros.")
    print("OK: 18-23 meses: 26 escalas, 300 registros.")
    print("OK: 24-35 meses: 28 escalas, 510 registros.")
    print(f"OK: total N-3..N-27: exactamente {EXPECTED_TOTAL_RECORDS} registros validados (0-5, 6-11, 12-17, 18-23 y 24-35 meses).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
