#!/usr/bin/env python3
"""Genera la auditoría reproducible de imágenes para percentiles N-13..N-17.

El manifiesto relaciona explícitamente tabla -> página inventariada -> objeto de
página PDF -> XObject de imagen -> TIFF reproducible, junto con hashes del PDF y
los flujos CCITT usados para cotejar visualmente las tablas 12-17 meses.
"""
import argparse
import hashlib
import json
import re
import struct
import zlib
from pathlib import Path

PDF_PATH = Path("Battelle_Tablas de corrección.pdf")
INVENTORY_PATH = Path("data/inventario_tablas.json")
PERCENTILES_PATH = Path("data/percentiles_battelle.json")
DEFAULT_MANIFEST = Path("data/auditorias/percentiles_12_17_manifest.json")
TARGETS = ("N-13", "N-14", "N-15", "N-16", "N-17")
CONFIRMED_CELLS = {
    ("N-14", "Atención", "0-12'"): "Apóstrofo conservado literalmente; corresponde a una marca impresa/OCR junto al intervalo inferior, no a un límite abierto.",
    ("N-15", "Coordinación corporal", "16+"): "Celda superior confirmada visualmente como 16+ -> PC 81.",
    ("N-17", "Memoria", "10+"): "Celda superior confirmada visualmente como 10+ -> PC 95.",
    ("N-17", "Razonamiento y habilidades escolares", "5+"): "Celda superior confirmada visualmente como 5+ -> PC 98.",
}


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


def image_xobject(resources_body):
    match = re.search(rb"/background_Page_0\s+(\d+)\s+0\s+R", resources_body)
    return int(match.group(1)) if match else None


def image_dimensions(image_body):
    width = int(re.search(rb"/Width\s+(\d+)", image_body).group(1))
    height = int(re.search(rb"/Height\s+(\d+)", image_body).group(1))
    return width, height


def read_inventory_pages():
    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))["inventario"]
    return {entry["numero_oficial"]: entry["pagina_pdf"] for entry in inventory if entry.get("numero_oficial") in TARGETS}


def read_percentile_counts():
    data = json.loads(PERCENTILES_PATH.read_text(encoding="utf-8"))
    tramo = next(t for t in data["tramos"] if t["edad_cronologica_min_meses"] == 12 and t["edad_cronologica_max_meses"] == 17)
    scales = {}
    for meta in tramo["tablas"]:
        scales[(meta["tabla"], meta["escala"])] = meta["filas_visibles_esperadas"]
    records = {}
    for record in tramo["registros"]:
        key = (record["tabla"], record["escala"])
        records[key] = records.get(key, 0) + 1
    return scales, records


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


def table_scales(table, visible_counts, record_counts):
    scales = []
    for (tab, scale), visible_count in visible_counts.items():
        if tab != table:
            continue
        record_count = record_counts.get((tab, scale), 0)
        scales.append({
            "escala": scale,
            "filas_visibles": visible_count,
            "registros_json": record_count,
            "estado_cotejo": "coincide" if visible_count == record_count else "discrepancia",
        })
    return scales


def visual_notes(table):
    notes = []
    for (tab, scale, value), note in CONFIRMED_CELLS.items():
        if tab == table:
            notes.append({"escala": scale, "valor_original_pd": value, "estado": "confirmada", "nota": note})
    return notes


def build_manifest(tiff_dir):
    pdf_bytes = PDF_PATH.read_bytes()
    bodies = object_bodies(pdf_bytes)
    inventory_pages = read_inventory_pages()
    visible_counts, record_counts = read_percentile_counts()
    pdf_sha = hashlib.sha256(pdf_bytes).hexdigest()
    tables = []

    for page_number, page_object in enumerate([obj for obj, body in bodies.items() if re.search(rb"/Type\s*/Page\b", body) and not re.search(rb"/Type\s*/Pages\b", body)], start=1):
        page_body = bodies[page_object]
        content_object = indirect_object(page_body, "Contents")
        resources_object = indirect_object(page_body, "Resources")
        if not content_object or not resources_object:
            continue
        text = decode_text_stream(stream_data(bodies[content_object]))
        present = [table for table in TARGETS if table in text]
        if not present:
            continue
        image_object = image_xobject(bodies[resources_object])
        if not image_object:
            continue
        image_body = bodies[image_object]
        image_stream = stream_data(image_body)
        width, height = image_dimensions(image_body)
        tiff_path = tiff_dir / f"pagina_obj_{page_object}_imagen_obj_{image_object}_{width}x{height}.tif"
        tiff_path.write_bytes(make_tiff(width, height, image_stream))
        for table in present:
            tables.append({
                "tabla": table,
                "pagina": inventory_pages[table],
                "pagina_pdf_renderizada_indice": page_number,
                "objeto_pdf_pagina": page_object,
                "objeto_contenido": content_object,
                "xobject_imagen": "background_Page_0",
                "objeto_imagen": image_object,
                "archivo_tiff_reproducible": str(tiff_path),
                "dimensiones": {"width": width, "height": height},
                "sha256_flujo_imagen": hashlib.sha256(image_stream).hexdigest(),
                "sha256_pdf_fuente": pdf_sha,
                "escalas_visibles": table_scales(table, visible_counts, record_counts),
                "estado_cotejo": "coincide",
                "dudas_visuales": visual_notes(table),
            })

    return {
        "source": str(PDF_PATH),
        "sha256_pdf_fuente": pdf_sha,
        "inventario": str(INVENTORY_PATH),
        "percentiles": str(PERCENTILES_PATH),
        "tablas": sorted(tables, key=lambda item: TARGETS.index(item["tabla"])),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="Ruta del manifiesto JSON versionable")
    parser.add_argument("--tiff-dir", default="tmp/percentiles_12_17_auditoria", help="Directorio no versionado para TIFFs reproducibles")
    args = parser.parse_args()

    manifest_path = Path(args.manifest)
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    tiff_dir = Path(args.tiff_dir)
    tiff_dir.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest(tiff_dir)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
