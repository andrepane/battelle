# Importación de baremos Battelle desde Excel

Esta fase genera fuentes normativas JSON leyendo exclusivamente los XLSX organizados en `fuentes/`. No usa OCR, PDF, datos históricos ni baremos incrustados en JavaScript, y no conecta los JSON a la interfaz.

## Componentes

- `scripts/battelle_excel/xlsx_reader.py`: lector XLSX basado en XML interno de los libros.
- `scripts/battelle_excel/normalization.py`: normalización de puntuaciones directas, intervalos y límites abiertos.
- `scripts/battelle_excel/extract.py`: extracción de percentiles, conversiones generales y edades equivalentes.
- `scripts/battelle_excel/model.py`: máximos teóricos derivados de `data/items_areas_subareas.json`.
- `scripts/generar_baremos_battelle.py`: genera los JSON activos.
- `scripts/validar_baremos_battelle.py`: re-lee Excel y compara contra los JSON generados.

## Salidas

- `data/percentiles_battelle.json`
- `data/conversion_total_battelle.json`
- `data/conversion_pc_general.json`
- `data/edades_equivalentes.json`
- `data/baremos_metadata.json`
- `data/baremos_incidencias.json`

Cada registro normativo conserva procedencia con archivo relativo, SHA-256, hoja y fila. La fecha queda en metadatos y debe excluirse de comparaciones canónicas de determinismo.

## Excepción N-56 / Personal-Social / PD 51

La discontinuidad confirmada de la tabla N-56 se registra como un elemento auditable con estado `pd_no_alcanzable_confirmada`. No se modifica el Excel, no se amplían los intervalos vecinos (`48-50` y `52-53`) y no se inventa edad equivalente para PD 51.

## Validación

Ejecutar:

```bash
python3 scripts/generar_baremos_battelle.py
python3 scripts/validar_baremos_battelle.py
python3 -m unittest tests/test_baremos_battelle.py
```

El validador comprueba presencia de familias normativas, casos conocidos de N-1 y N-65, trazabilidad Excel y relectura cruzada de los XLSX. Si aparece una incidencia bloqueante, debe registrarse en `data/baremos_incidencias.json` y la validación debe fallar.
