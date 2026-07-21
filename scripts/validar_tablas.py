#!/usr/bin/env python3
"""Valida el inventario de tablas Battelle y su estado de normalización.

El script comprueba metadatos estructurales y reglas semánticas automatizables.
La localización visual página a página y la lectura literal completa de cada
encabezado son revisiones manuales documentadas en data/informe_extraccion.md.
"""
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
VALID_CONFIDENCE = {"alta", "media", "baja"}
REQUIRED = {
    "tabla", "numero_oficial", "titulo_completo", "pagina_pdf", "paginas_pdf",
    "finalidad", "area_o_subarea", "tramo_edad_cronologica_aplicable",
    "variables_entrada", "resultado_producido", "encabezados_visibles",
    "estado_actual_normalizacion", "nivel_confianza", "observaciones",
    "requiere_lectura_visual",
}
CONFIRMED_ABSENT = {2, 39}
EXPECTED_PRESENT = set(range(1, 66)) - CONFIRMED_ABSENT


def fail(errors: list[str], message: str) -> None:
    errors.append(message)


def has_all(values: list[str], needles: list[str]) -> bool:
    text = " | ".join(values).lower()
    return all(n.lower() in text for n in needles)


def main() -> int:
    errors: list[str] = []
    inventory_doc = json.loads(INVENTARIO.read_text(encoding="utf-8"))
    conversion_doc = json.loads(CONVERSION.read_text(encoding="utf-8"))
    entries = inventory_doc.get("inventario", [])
    by_origin = {table.get("id"): table for table in conversion_doc.get("tables", [])}

    ids = [entry.get("tabla") for entry in entries]
    for duplicated, count in Counter(ids).items():
        if count > 1:
            fail(errors, f"identificador duplicado: {duplicated} ({count} veces)")

    official_numbers: list[int] = []
    official_entries = []
    for index, entry in enumerate(entries, start=1):
        missing = REQUIRED - set(entry)
        if missing:
            fail(errors, f"entrada {index}: faltan campos obligatorios {sorted(missing)}")
        state = entry.get("estado_actual_normalizacion")
        confidence = entry.get("nivel_confianza")
        if state not in VALID_STATES:
            fail(errors, f"{entry.get('tabla')}: estado inválido {state!r}")
        if confidence not in VALID_CONFIDENCE:
            fail(errors, f"{entry.get('tabla')}: nivel_confianza inválido {confidence!r}")
        if entry.get("numero_oficial") is None:
            continue
        if entry.get("pagina_pdf") is None:
            fail(errors, f"{entry.get('tabla')}: pagina_pdf no puede ser null")
        if not isinstance(entry.get("paginas_pdf"), list) or not entry.get("paginas_pdf"):
            fail(errors, f"{entry.get('tabla')}: paginas_pdf debe ser lista no vacía")

        match = re.fullmatch(r"N-(\d+)", str(entry.get("numero_oficial")))
        if not match:
            fail(errors, f"{entry.get('tabla')}: número oficial inválido {entry.get('numero_oficial')!r}")
            continue
        number = int(match.group(1))
        official_numbers.append(number)
        official_entries.append(entry)

        origin = by_origin.get(entry.get("id_origen"))
        if origin:
            rows = origin.get("filas", [])
            has_token_rows = any(isinstance(row, dict) and "valores" in row for row in rows)
            headers = origin.get("encabezados_columnas", [])
            if state == "normalizada" and (has_token_rows or not rows or not headers):
                fail(errors, f"{entry.get('tabla')}: marcada normalizada sin filas/encabezados explícitos")
            if has_token_rows and state != "tokens_sin_normalizar":
                fail(errors, f"{entry.get('tabla')}: conserva valores[] y no puede marcarse como {state}")

        title = entry.get("titulo_completo", "")
        area = entry.get("area_o_subarea", "")
        inputs = entry.get("variables_entrada", [])
        outputs = entry.get("resultado_producido", [])
        purpose = entry.get("finalidad", "")
        if number == 1:
            if not has_all(inputs, ["PC"]) or not has_all(outputs, ["z", "T", "CI", "ECN"]):
                fail(errors, "N-1: debe tener entrada PC y salidas z, T, CI y ECN")
        if any(word in title for word in ["Receptiva", "Expresiva"]):
            if area != "Comunicación":
                fail(errors, f"{entry.get('tabla')}: Receptiva/Expresiva deben asignarse a Comunicación")
        if any(word in title for word in ["Interacción con el adulto", "Expresión de sentimientos", "Autoconcepto"]):
            if area != "Personal-Social":
                fail(errors, f"{entry.get('tabla')}: contenido personal/social mal clasificado")
        if "centiles" in title and number != 1:
            if purpose != "conversion_pd_a_percentil" or not has_all(inputs, ["PD"]) or not has_all(outputs, ["PC"]):
                fail(errors, f"{entry.get('tabla')}: incoherencia título/finalidad/entradas/resultados para centiles")
        if "Edades equivalentes" in title:
            if purpose != "edad_equivalente" or not has_all(outputs, ["edad equivalente"]):
                fail(errors, f"{entry.get('tabla')}: incoherencia en tabla de edad equivalente")

    found = set(official_numbers)
    missing = sorted(EXPECTED_PRESENT - found)
    unexpected_absent_present = sorted(CONFIRMED_ABSENT & found)
    duplicated_numbers = sorted(n for n, c in Counter(official_numbers).items() if c > 1)
    if missing:
        fail(errors, "faltan tablas oficiales confirmadas: " + ", ".join(f"N-{n}" for n in missing))
    if unexpected_absent_present:
        fail(errors, "aparecen números confirmados ausentes: " + ", ".join(f"N-{n}" for n in unexpected_absent_present))

    print(f"Tablas oficiales presentes: {len(found)}")
    print(f"Ausencias confirmadas: {', '.join(f'N-{n}' for n in sorted(CONFIRMED_ABSENT))}")
    print(f"Números duplicados: {', '.join(f'N-{n}' for n in duplicated_numbers) or 'ninguno'}")
    print("Recuento por finalidad:")
    for key, value in sorted(Counter(e.get("finalidad") for e in official_entries).items()):
        print(f"  - {key}: {value}")
    print("Recuento por nivel de confianza:")
    for key, value in sorted(Counter(e.get("nivel_confianza") for e in entries).items()):
        print(f"  - {key}: {value}")
    if errors:
        print("\nERRORES:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print("Validación automatizada completada sin errores.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
