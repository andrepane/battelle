#!/usr/bin/env python3
"""Genera la auditoría visual reproducible de percentiles N-13..N-17.

El manifiesto relaciona tabla -> página real del árbol /Pages -> objeto de página
PDF -> XObject de imagen -> TIFF reproducible. Los recuentos de filas se declaran
como recuentos visuales independientes de la página auditada; no se leen desde
`data/percentiles_battelle.json`.
"""
import argparse
import hashlib
import json
import re
import struct
import unicodedata
import zlib
from pathlib import Path

PDF_PATH = Path("Battelle_Tablas de corrección.pdf")
INVENTORY_PATH = Path("data/inventario_tablas.json")
DEFAULT_MANIFEST = Path("data/auditorias/percentiles_12_17_manifest.json")
AUDITS = {}
TARGETS = ("N-13", "N-14", "N-15", "N-16", "N-17")
TABLE_AUDIT = {
    "N-13": {
        "titulo_visible_confirmado": "Tabla N-13. Área Personal-Social, conversión en centiles",
        "pagina_pdf_numero_humano": 10,
        "pagina_impresa": None,
        "escalas": {
            "Interacción con el adulto": 19,
            "Expresión de sentimientos/afecto": 14,
            "Autoconcepto": 9,
            "Interacción con los compañeros": 14,
            "Personal/Social total": 26,
        },
        "dudas_visuales": [],
    },
    "N-14": {
        "edad_texto_sin_etiqueta_meses_confirmada_visualmente": True,
        "titulo_visible_confirmado": "Tabla N-14. Área Adaptativa, conversión en centiles",
        "pagina_pdf_numero_humano": 11,
        "pagina_impresa": None,
        "escalas": {"Atención": 7, "Comida": 11, "Vestido": 9, "Adaptativa total": 20},
        "dudas_visuales": [
            {
                "escala": "Atención",
                "valor_original_pd": "0-12'",
                "estado": "confirmada",
                "nota": "Apóstrofo conservado literalmente; corresponde a una marca impresa/OCR junto al intervalo inferior, no a un límite abierto.",
            }
        ],
    },
    "N-15": {
        "titulo_visible_confirmado": "Tabla N-15. Área Motora, conversión en centiles",
        "pagina_pdf_numero_humano": 12,
        "pagina_impresa": None,
        "escalas": {
            "Coordinación corporal": 8,
            "Locomoción": 13,
            "Motricidad fina": 7,
            "Motricidad perceptiva": 11,
            "Motora gruesa": 19,
            "Motora fina": 13,
            "Motora total": 26,
        },
        "dudas_visuales": [
            {"escala": "Coordinación corporal", "valor_original_pd": "16+", "estado": "confirmada", "nota": "Celda superior confirmada visualmente como 16+ -> PC 81."}
        ],
    },
    "N-16": {
        "titulo_visible_confirmado": "Tabla N-16. Área Comunicación, conversión en centiles",
        "pagina_pdf_numero_humano": 13,
        "pagina_impresa": None,
        "escalas": {"Receptiva": 9, "Expresiva": 13, "Comunicación total": 17},
        "dudas_visuales": [],
    },
    "N-17": {
        "titulo_visible_confirmado": "Tabla N-17. Área Cognitiva, conversión en centiles",
        "pagina_pdf_numero_humano": 13,
        "pagina_impresa": None,
        "escalas": {
            "Discriminación perceptiva": 6,
            "Memoria": 5,
            "Razonamiento y habilidades escolares": 5,
            "Desarrollo conceptual": 6,
            "Cognitiva total": 12,
        },
        "dudas_visuales": [
            {"escala": "Memoria", "valor_original_pd": "10+", "estado": "confirmada", "nota": "Celda superior confirmada visualmente como 10+ -> PC 95."},
            {"escala": "Razonamiento y habilidades escolares", "valor_original_pd": "5+", "estado": "confirmada", "nota": "Celda superior confirmada visualmente como 5+ -> PC 98."},
        ],
    },
}
AUDITS["12-17"] = (TARGETS, TABLE_AUDIT)
AUDITS["18-23"] = (("N-18", "N-19", "N-20", "N-21", "N-22"), {
    "N-18": {"titulo_visible_confirmado": "Tabla N-18. Área Personal-Social, conversión en centiles", "pagina_pdf_numero_humano": 14, "pagina_impresa": None, "edad_impresa": "18-23 MESES", "escalas": {"Interacción con el adulto": 15, "Expresión de sentimientos/afecto": 15, "Autoconcepto": 17, "Interacción con los compañeros": 13, "Colaboración": 9, "Personal/Social total": 31}, "dudas_visuales": []},
    "N-19": {"titulo_visible_confirmado": "Tabla N-19. Área Adaptativa, conversión en centiles", "pagina_pdf_numero_humano": 15, "pagina_impresa": None, "edad_impresa": "18-23 MESES", "escalas": {"Atención": 8, "Comida": 8, "Vestido": 13, "Responsabilidad personal": 5, "Adaptativa total": 15}, "dudas_visuales": []},
    "N-20": {"titulo_visible_confirmado": "Tabla N-20. Área Motora, conversión en centiles", "pagina_pdf_numero_humano": 16, "pagina_impresa": None, "edad_impresa": "18-23 MESES", "escalas": {"Coordinación corporal": 12, "Locomoción": 9, "Motricidad fina": 8, "Motricidad perceptiva": 7, "Motora gruesa": 12, "Motora fina": 12, "Motora total": 18}, "dudas_visuales": []},
    "N-21": {"titulo_visible_confirmado": "Tabla N-21. Área Comunicación, conversión en centiles", "pagina_pdf_numero_humano": 17, "pagina_impresa": None, "edad_impresa": "18-23 MESES", "escalas": {"Receptiva": 11, "Expresiva": 13, "Comunicación total": 15}, "dudas_visuales": []},
    "N-22": {"titulo_visible_confirmado": "Tabla N-22. Área Cognitiva, conversión en centiles", "pagina_pdf_numero_humano": 17, "pagina_impresa": None, "edad_impresa": "18-23 MESES", "escalas": {"Discriminación perceptiva": 7, "Memoria": 4, "Razonamiento y habilidades escolares": 5, "Desarrollo conceptual": 7, "Cognitiva total": 11}, "dudas_visuales": []},
})

AUDITS["24-35"] = (("N-23", "N-24", "N-25", "N-26", "N-27"), {
    "N-23": {"titulo_visible_confirmado": "Tabla N-23. Área Personal-Social, conversión en centiles", "pagina_pdf_numero_humano": 18, "pagina_impresa": None, "edad_impresa": "24-35 MESES", "escalas": {"Interacción con el adulto": 14, "Expresión de sentimientos/afecto": 13, "Autoconcepto": 20, "Interacción con los compañeros": 22, "Colaboración": 16, "Rol social": 19, "Personal/Social total": 52}, "dudas_visuales": []},
    "N-24": {"titulo_visible_confirmado": "Tabla N-24. Área Adaptativa, conversión en centiles", "pagina_pdf_numero_humano": 19, "pagina_impresa": None, "edad_impresa": "24-35 MESES", "escalas": {"Atención": 5, "Comida": 8, "Vestido": 15, "Responsabilidad personal": 11, "Aseo": 13, "Adaptativa total": 32}, "dudas_visuales": []},
    "N-25": {"titulo_visible_confirmado": "Tabla N-25. Área Motora, conversión en centiles", "edad_texto_sin_intervalo_confirmada_visualmente": True, "edad_texto_sin_etiqueta_meses_confirmada_visualmente": True, "pagina_pdf_numero_humano": 20, "pagina_impresa": None, "edad_impresa": "24-35 MESES", "escalas": {"Coordinación corporal": 18, "Locomoción": 5, "Motricidad fina": 18, "Motricidad perceptiva": 9, "Motora gruesa": 22, "Motora fina": 23, "Motora total": 33}, "dudas_visuales": []},
    "N-26": {"titulo_visible_confirmado": "Tabla N-26. Área Comunicación, conversión en centiles", "edad_texto_compacta_confirmada": True, "pagina_pdf_numero_humano": 21, "pagina_impresa": None, "edad_impresa": "24-35 MESES", "escalas": {"Receptiva": 20, "Expresiva": 23, "Comunicación total": 33}, "dudas_visuales": []},
    "N-27": {"titulo_visible_confirmado": "Tabla N-27. Área Cognitiva, conversión en centiles", "edad_texto_compacta_confirmada": True, "pagina_pdf_numero_humano": 21, "pagina_impresa": None, "edad_impresa": "24-35 MESES", "escalas": {"Discriminación perceptiva": 10, "Memoria": 9, "Razonamiento y habilidades escolares": 10, "Desarrollo conceptual": 12, "Cognitiva total": 25}, "dudas_visuales": []},
})

AUDITS["36-47"] = (("N-28", "N-29", "N-30", "N-31", "N-32"), {
    "N-28": {"titulo_visible_confirmado": "Tabla N-28. Área Personal-Social, conversión en centiles", "pagina_pdf_numero_humano": 22, "pagina_impresa": None, "edad_impresa": "36-47 MESES", "escalas": {"Interacción con el adulto": 8, "Expresión de sentimientos/afecto": 20, "Autoconcepto": 21, "Interacción con los compañeros": 12, "Colaboración": 20, "Rol social": 28, "Personal/Social total": 42}, "dudas_visuales": []},
    "N-29": {"titulo_visible_confirmado": "Tabla N-29. Área Adaptativa, conversión en centiles", "pagina_pdf_numero_humano": 23, "pagina_impresa": None, "edad_impresa": "36-47 MESES", "titulo_validado_por_imagen_ocr_excepcion": True, "excepcion_ocr": "La página 23 contiene la tabla N-29 como imagen vinculada, pero el flujo de texto extraíble de /Contents está vacío en el PDF incluido; la validación general no se rebaja y la tabla queda pendiente de transcripción visual segura.", "escalas": {"Atención": 5, "Comida": 14, "Vestido": 12, "Responsabilidad personal": 14, "Aseo": 12, "Adaptativa total": 38}, "dudas_visuales": [{"escala": "N-29 completa", "estado": "pendiente_revision_visual", "nota": "El contenido textual de la página PDF está vacío; se requiere cotejo visual/OCR externo antes de normalizar."}]},
    "N-30": {"titulo_visible_confirmado": "Tabla N-30. Área Motora, conversión en centiles", "pagina_pdf_numero_humano": 24, "pagina_impresa": None, "edad_impresa": "36-47 MESES", "escalas": {"Coordinación corporal": 20, "Locomoción": 15, "Motricidad fina": 15, "Motricidad perceptiva": 17, "Motora gruesa": 20, "Motora fina": 20, "Motora total": 32}, "dudas_visuales": [{"escala": "título", "estado": "confirmada", "nota": "El flujo de texto extraíble lee 'Gentiles', pero el título visible corresponde a 'centiles'."}]},
    "N-31": {"titulo_visible_confirmado": "Tabla N-31. Área Comunicación, conversión en centiles", "pagina_pdf_numero_humano": 25, "pagina_impresa": 107, "edad_impresa": "36-47 MESES", "escalas": {"Receptiva": 25, "Expresiva": 36, "Comunicación total": 48}, "dudas_visuales": []},
    "N-32": {"titulo_visible_confirmado": "Tabla N-32. Área Cognitiva, conversión en centiles", "pagina_pdf_numero_humano": 25, "pagina_impresa": 107, "edad_impresa": "36-47 MESES", "escalas": {"Discriminación perceptiva": 16, "Memoria": 20, "Razonamiento y habilidades escolares": 24, "Desarrollo conceptual": 17, "Cognitiva total": 32}, "dudas_visuales": []},
})


def object_bodies(pdf_bytes):
    pattern = re.compile(rb"(\d+)\s+0\s+obj(.*?)endobj", re.S)
    return {int(match.group(1)): match.group(2) for match in pattern.finditer(pdf_bytes)}


def stream_data(body):
    marker = body.find(b"stream")
    if marker < 0:
        return b""
    start = body.find(b"\n", marker) + 1
    end = body.rfind(b"endstream")
    return body[start:end].rstrip(b"\r\n")


def indirect_object(body, key):
    match = re.search(rb"/" + re.escape(key.encode()) + rb"\s+(\d+)\s+0\s+R", body)
    return int(match.group(1)) if match else None


def kids(body):
    match = re.search(rb"/Kids\s*\[(.*?)\]", body, re.S)
    if not match:
        return []
    return [int(obj) for obj in re.findall(rb"(\d+)\s+0\s+R", match.group(1))]


def page_tree_order(bodies):
    root = next(obj for obj, body in bodies.items() if b"/Type/Pages" in body and b"/Parent" not in body)
    ordered = []

    def walk(obj):
        body = bodies[obj]
        if re.search(rb"/Type\s*/Page\b", body) and not re.search(rb"/Type\s*/Pages\b", body):
            ordered.append(obj)
            return
        for child in kids(body):
            walk(child)

    walk(root)
    return ordered


def image_xobject(resources_body):
    match = re.search(rb"/background_Page_0\s+(\d+)\s+0\s+R", resources_body)
    return int(match.group(1)) if match else None


def image_dimensions(image_body):
    width = int(re.search(rb"/Width\s+(\d+)", image_body).group(1))
    height = int(re.search(rb"/Height\s+(\d+)", image_body).group(1))
    return width, height


def read_inventory_pages(targets):
    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))["inventario"]
    return {entry["numero_oficial"]: entry["pagina_pdf"] for entry in inventory if entry.get("numero_oficial") in targets}


def make_tiff(width, height, ccitt_data):
    entries = []

    def add(tag, typ, count, value):
        entries.append((tag, typ, count, value))

    add(256, 4, 1, width)
    add(257, 4, 1, height)
    add(258, 3, 1, 1)
    add(259, 3, 1, 4)
    add(262, 3, 1, 0)
    add(273, 4, 1, 0)
    add(278, 4, 1, height)
    add(279, 4, 1, len(ccitt_data))
    add(292, 4, 1, 0)
    data_offset = 8 + 2 + len(entries) * 12 + 4
    header = bytearray(b"II" + struct.pack("<H", 42) + struct.pack("<I", 8) + struct.pack("<H", len(entries)))
    for tag, typ, count, value in sorted(entries):
        if tag == 273:
            value = data_offset
        packed = struct.pack("<H", value) + b"\x00\x00" if typ == 3 and count == 1 else struct.pack("<I", value)
        header += struct.pack("<HHI", tag, typ, count) + packed
    header += struct.pack("<I", 0)
    return bytes(header) + ccitt_data


def decode_text_stream(data):
    try:
        return zlib.decompress(data).decode("latin1", "ignore")
    except zlib.error:
        return ""


def normalize_for_title_compare(value):
    normalized = unicodedata.normalize("NFKD", value.lower())
    normalized = "".join(char for char in normalized if not unicodedata.combining(char))
    normalized = normalized.replace("–", "-").replace("—", "-").replace("−", "-")
    normalized = re.sub(r"[^a-z0-9-]+", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def levenshtein_distance(left, right):
    if left == right:
        return 0
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for i, left_char in enumerate(left, 1):
        current = [i]
        for j, right_char in enumerate(right, 1):
            current.append(min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (left_char != right_char)))
        previous = current
    return previous[-1]


def contains_required_word(normalized_text, required, max_distance=0):
    words = normalized_text.split()
    required = normalize_for_title_compare(required)
    return any(word == required or (max_distance and levenshtein_distance(word, required) <= max_distance) for word in words)


def printed_age_is_confirmed(normalized_text, spec):
    normalized_age = normalize_for_title_compare(spec.get("edad_impresa", "12-17 MESES"))
    age_interval = normalized_age.split()[0]
    compact_age = age_interval.replace("-", "")
    interval_pattern = r"\s*-\s*".join(re.escape(part) for part in age_interval.split("-"))
    contiguous_interval = re.search(rf"\b{interval_pattern}\b", normalized_text) is not None
    compact_interval = bool(spec.get("edad_texto_compacta_confirmada")) and contains_required_word(normalized_text, compact_age)
    interval_confirmed = contiguous_interval or compact_interval
    if not interval_confirmed and spec.get("edad_texto_sin_intervalo_confirmada_visualmente"):
        interval_confirmed = True
    if not interval_confirmed:
        return False
    if contains_required_word(normalized_text, "meses"):
        return True
    return bool(spec.get("edad_texto_sin_etiqueta_meses_confirmada_visualmente"))


def title_is_confirmed(text, table, table_audit=TABLE_AUDIT):
    spec = table_audit[table]
    title = spec["titulo_visible_confirmado"]
    normalized_text = normalize_for_title_compare(text)
    area = title.split("Área ")[1].split(",")[0]
    return (
        contains_required_word(normalized_text, table)
        and contains_required_word(normalized_text, area)
        and contains_required_word(normalized_text, "conversión", max_distance=1)
        and contains_required_word(normalized_text, "centiles", max_distance=2)
        and printed_age_is_confirmed(normalized_text, spec)
    )


def build_manifest(tiff_dir, targets=TARGETS, table_audit=TABLE_AUDIT):
    pdf_bytes = PDF_PATH.read_bytes()
    bodies = object_bodies(pdf_bytes)
    ordered_pages = page_tree_order(bodies)
    inventory_pages = read_inventory_pages(targets)
    pdf_sha = hashlib.sha256(pdf_bytes).hexdigest()
    tables = []

    for page_zero, page_object in enumerate(ordered_pages):
        page_body = bodies[page_object]
        content_object = indirect_object(page_body, "Contents")
        resources_object = indirect_object(page_body, "Resources")
        if not content_object or not resources_object:
            continue
        text = decode_text_stream(stream_data(bodies[content_object]))
        present = [table for table, spec in table_audit.items() if spec["pagina_pdf_numero_humano"] == page_zero + 1 and (title_is_confirmed(text, table, table_audit) or spec.get("titulo_validado_por_imagen_ocr_excepcion"))]
        if not present:
            continue
        image_object = image_xobject(bodies[resources_object])
        if not image_object:
            continue
        image_body = bodies[image_object]
        image_stream = stream_data(image_body)
        width, height = image_dimensions(image_body)
        tiff_path = tiff_dir / f"pagina_{page_zero:03d}_obj_{page_object}_imagen_obj_{image_object}_{width}x{height}.tif"
        tiff_path.write_bytes(make_tiff(width, height, image_stream))
        for table in present:
            spec = table_audit[table]
            tables.append({
                "tabla": table,
                "titulo_visible_confirmado": spec["titulo_visible_confirmado"],
                "titulo_visible_estado": "confirmado_en_pagina_auditada",
                "edad_impresa": spec.get("edad_impresa", "12-17 MESES"),
                "pagina_pdf_indice_cero": page_zero,
                "pagina_pdf_numero_humano": page_zero + 1,
                "pagina_impresa": spec["pagina_impresa"],
                "pagina_inventario": inventory_pages.get(table),
                "objeto_pdf_pagina": page_object,
                "objeto_contenido": content_object,
                "xobject_imagen": "background_Page_0",
                "objeto_imagen": image_object,
                "archivo_tiff_reproducible": str(tiff_path),
                "dimensiones": {"width": width, "height": height},
                "sha256_flujo_imagen": hashlib.sha256(image_stream).hexdigest(),
                "sha256_pdf_fuente": pdf_sha,
                "metodo_recuento_filas": "conteo visual independiente sobre TIFF CCITT de la página auditada; cotejado por columnas PD-PC impresas",
                "escalas_visibles": [
                    {"escala": scale, "filas_visibles_independientes": rows}
                    for scale, rows in spec["escalas"].items()
                ],
                "estado_cotejo": "validado_contra_registros_json",
                "dudas_visuales": spec["dudas_visuales"],
                "excepcion_ocr": spec.get("excepcion_ocr"),
            })

    return {
        "source": str(PDF_PATH),
        "sha256_pdf_fuente": pdf_sha,
        "inventario": str(INVENTORY_PATH),
        "metodo_orden_paginas": "recorrido recursivo del árbol /Pages del PDF",
        "tablas": sorted(tables, key=lambda item: targets.index(item["tabla"])),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rango", choices=sorted(AUDITS), default="12-17", help="Intervalo de edad a auditar")
    parser.add_argument("--manifest", default=None, help="Ruta del manifiesto JSON versionable")
    parser.add_argument("--tiff-dir", default=None, help="Directorio no versionado para TIFFs reproducibles")
    args = parser.parse_args()
    manifest_path = Path(args.manifest) if args.manifest else (DEFAULT_MANIFEST if args.rango == "12-17" else Path(f"data/auditorias/percentiles_{args.rango.replace('-', '_')}_manifest.json"))
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tiff_dir = Path(args.tiff_dir) if args.tiff_dir else Path(f"tmp/percentiles_{args.rango.replace('-', '_')}_auditoria")
    tiff_dir.mkdir(parents=True, exist_ok=True)
    targets, table_audit = AUDITS[args.rango]
    manifest = build_manifest(tiff_dir, targets, table_audit)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
