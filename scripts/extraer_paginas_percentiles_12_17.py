#!/usr/bin/env python3
"""Extrae imágenes embebidas y tokens posicionados para auditar N-13..N-17.

No requiere dependencias externas: envuelve los flujos CCITT Fax del PDF en TIFF
para inspección visual de alta resolución y vuelca los tokens posicionados de las
páginas localizadas en `data/inventario_tablas.json`.
"""
import argparse
import json
import re
import struct
import zlib
from pathlib import Path

PDF_PATH = Path("Battelle_Tablas de corrección.pdf")
INVENTORY_PATH = Path("data/inventario_tablas.json")
TARGETS = ("N-13", "N-14", "N-15", "N-16", "N-17")


def read_inventory_pages():
    inventory = json.loads(INVENTORY_PATH.read_text(encoding="utf-8"))["inventario"]
    return {entry["numero_oficial"]: entry["pagina_pdf"] for entry in inventory if entry.get("numero_oficial") in TARGETS}


def iter_streams(pdf_bytes):
    pattern = re.compile(rb"(\d+)\s+0\s+obj\s*<<(.*?)>>stream\r?\n", re.S)
    for stream_index, match in enumerate(pattern.finditer(pdf_bytes)):
        dictionary = match.group(2)
        start = match.end()
        end = pdf_bytes.find(b"endstream", start)
        if end < 0:
            continue
        yield stream_index, int(match.group(1)), dictionary, pdf_bytes[start:end].rstrip(b"\r\n")


def make_tiff(width, height, ccitt_data):
    entries = []

    def add(tag, typ, count, value):
        entries.append((tag, typ, count, value))

    add(256, 4, 1, width)  # ImageWidth
    add(257, 4, 1, height)  # ImageLength
    add(258, 3, 1, 1)  # BitsPerSample
    add(259, 3, 1, 4)  # Compression: CCITT Group 4
    add(262, 3, 1, 0)  # PhotometricInterpretation: WhiteIsZero
    add(273, 4, 1, 0)  # StripOffsets; filled below
    add(278, 4, 1, height)  # RowsPerStrip
    add(279, 4, 1, len(ccitt_data))  # StripByteCounts
    add(292, 4, 1, 0)  # T4/T6 options

    ifd_offset = 8
    data_offset = 8 + 2 + len(entries) * 12 + 4
    header = bytearray(b"II" + struct.pack("<H", 42) + struct.pack("<I", ifd_offset) + struct.pack("<H", len(entries)))
    for tag, typ, count, value in sorted(entries):
        if tag == 273:
            value = data_offset
        packed_value = struct.pack("<H", value) + b"\x00\x00" if typ == 3 and count == 1 else struct.pack("<I", value)
        header += struct.pack("<HHI", tag, typ, count) + packed_value
    header += struct.pack("<I", 0)
    return bytes(header) + ccitt_data


def decode_text_stream(data):
    try:
        return zlib.decompress(data).decode("latin1", "ignore")
    except zlib.error:
        return ""


def positioned_tokens(text):
    tokens = []
    last_position = None
    for line in text.splitlines():
        position = re.search(r"1 0 0 1 ([\d.-]+) ([\d.-]+) Tm", line)
        if position:
            last_position = (float(position.group(1)), float(position.group(2)))
        token = re.search(r"\((.*)\) Tj", line)
        if token and last_position:
            tokens.append({"x": last_position[0], "y": last_position[1], "texto": token.group(1)})
    return tokens


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="tmp/percentiles_12_17_auditoria", help="Directorio de salida")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    pdf_bytes = PDF_PATH.read_bytes()
    pages = read_inventory_pages()
    report = {"paginas_inventario": pages, "imagenes_ccitt": [], "tokens_posicionados": []}

    for stream_index, object_number, dictionary, data in iter_streams(pdf_bytes):
        if b"/Subtype/Image" in dictionary and b"/CCITTFaxDecode" in dictionary and b"/Width" in dictionary and b"/Height" in dictionary:
            width = int(re.search(rb"/Width\s+(\d+)", dictionary).group(1))
            height = int(re.search(rb"/Height\s+(\d+)", dictionary).group(1))
            if width < 1000 or height < 1000:
                continue
            filename = out_dir / f"ccitt_stream_{stream_index:03d}_obj_{object_number}_{width}x{height}.tif"
            filename.write_bytes(make_tiff(width, height, data))
            report["imagenes_ccitt"].append({"stream": stream_index, "objeto": object_number, "archivo": str(filename), "width": width, "height": height})

        if b"/FlateDecode" in dictionary:
            text = decode_text_stream(data)
            present = [table for table in TARGETS if table in text]
            if present:
                token_file = out_dir / f"tokens_stream_{stream_index:03d}_{'_'.join(present)}.json"
                token_file.write_text(json.dumps(positioned_tokens(text), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                report["tokens_posicionados"].append({"stream": stream_index, "tablas": present, "archivo": str(token_file)})

    report_path = out_dir / "manifest.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
