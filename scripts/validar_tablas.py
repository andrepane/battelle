#!/usr/bin/env python3
"""Valida el inventario de tablas Battelle y su estado de normalización."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTARIO = ROOT / "data" / "inventario_tablas.json"
CONVERSION = ROOT / "data" / "tablas_conversion_battelle.json"
VALID_STATES = {"normalizada", "parcial", "tokens_sin_normalizar"}
REQUIRED = {
    "tabla", "numero_oficial", "titulo_completo", "pagina_pdf", "finalidad",
    "area_o_subarea", "tramo_edad_cronologica_aplicable", "variables_entrada",
    "resultado_producido", "estado_actual_normalizacion", "requiere_lectura_visual",
}


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def main() -> int:
    errors: list[str] = []
    if not INVENTARIO.exists():
        print(f"ERROR: no existe {INVENTARIO.relative_to(ROOT)}", file=sys.stderr)
        return 1
    inventory_doc = json.loads(INVENTARIO.read_text(encoding="utf-8"))
    conversion_doc = json.loads(CONVERSION.read_text(encoding="utf-8"))
    entries = inventory_doc.get("inventario", [])
    if not isinstance(entries, list) or not entries:
        fail(errors, "inventario debe ser una lista no vacía")

    ids = [entry.get("tabla") for entry in entries]
    for duplicated, count in Counter(ids).items():
        if count > 1:
            fail(errors, f"identificador duplicado: {duplicated} ({count} veces)")

    official_numbers: list[int] = []
    by_origin = {table.get("id"): table for table in conversion_doc.get("tables", [])}
    for index, entry in enumerate(entries, start=1):
        missing = REQUIRED - set(entry)
        if missing:
            fail(errors, f"entrada {index}: faltan campos obligatorios {sorted(missing)}")
        state = entry.get("estado_actual_normalizacion")
        if state not in VALID_STATES:
            fail(errors, f"{entry.get('tabla')}: estado inválido {state!r}")
        number = entry.get("numero_oficial")
        if number is not None:
            match = re.fullmatch(r"N-(\d+)", str(number))
            if not match:
                fail(errors, f"{entry.get('tabla')}: número oficial inválido {number!r}")
            else:
                official_numbers.append(int(match.group(1)))
        age = entry.get("tramo_edad_cronologica_aplicable")
        if not isinstance(age, dict):
            fail(errors, f"{entry.get('tabla')}: tramo_edad_cronologica_aplicable debe ser objeto")
        origin = by_origin.get(entry.get("id_origen"))
        if origin:
            rows = origin.get("filas", [])
            has_token_rows = any(isinstance(row, dict) and "valores" in row for row in rows)
            headers = origin.get("encabezados_columnas", [])
            if state == "normalizada" and (has_token_rows or not rows or not headers):
                fail(errors, f"{entry.get('tabla')}: marcada normalizada sin filas/encabezados explícitos")
            if has_token_rows and state != "tokens_sin_normalizar":
                fail(errors, f"{entry.get('tabla')}: conserva valores[] y no puede marcarse como {state}")

    expected = set(range(1, 66))
    found = set(official_numbers)
    missing = sorted(expected - found)
    duplicated_numbers = sorted(n for n, c in Counter(official_numbers).items() if c > 1)
    summary = inventory_doc.get("resumen", {})
    if summary.get("normalizadas") != sum(1 for e in entries if e.get("estado_actual_normalizacion") == "normalizada"):
        fail(errors, "resumen.normalizadas no coincide con el inventario")
    print(f"Tablas inventariadas: {len(entries)}")
    print(f"Normalizadas: {sum(1 for e in entries if e.get('estado_actual_normalizacion') == 'normalizada')}")
    print(f"Números ausentes: {', '.join(f'N-{n}' for n in missing) or 'ninguno'}")
    print(f"Números duplicados: {', '.join(f'N-{n}' for n in duplicated_numbers) or 'ninguno'}")
    if errors:
        print("\nERRORES:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
