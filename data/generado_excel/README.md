# Generación Battelle desde Excel OCR

Este directorio contiene salidas no autoritativas generadas en cuarentena desde los Excel `Battelle_Tablas_de_correccion.xlsx` y `Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx`.

## Arquitectura

El parser se divide en módulos: lectura XLSX (`xlsx_io.py`), normalización OCR y PD (`normalization.py`), detección/clasificación de tablas (`detect.py`), extracción, preservación y exportación (`extract.py`) y validación (`validar_generado_excel.py`).

## Resultado actual

- Tablas esperadas: 52.
- Tablas localizadas de forma única por título OCR: 42.
- Registros PD→percentil exportados: 4555.
- Registros protegidos N-3..N-12 conservados desde v4: 461.
- Incidencias OCR/estructura: 57.
- Checksum protegido antes y después: `46fa96209bafccd9b1070da0b2617908f3e34bb0c317ebb3cc242badca45999d`.

Las tablas no localizadas o dudosas quedan reportadas en `cobertura_validacion.json` e `incidencias.json`; no se interpolan datos ni se marca ninguna fila nueva como `REVISADO_VISUALMENTE`.
