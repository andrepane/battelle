# Limpieza de fuentes antiguas Battelle

Referencia de respaldo local: `backup-antes-limpieza-fuentes` apunta al commit `ebf14297c94520a894aaa35a4868c3fb49908e73`.

## Inventario previo

| Archivo o patrón | Clasificación | Motivo | Referencias encontradas |
| --- | --- | --- | --- |
| `Cuaderno anotación Battelle buena calidad.pdf` | ELIMINAR | PDF fuente antiguo. | Sin referencias de ejecución. |
| `Battelle_Tablas de corrección.pdf` | ELIMINAR | PDF fuente antiguo de tablas. | Referenciado por scripts/informes eliminados. |
| `Battelle_Tablas_de_correccion.xlsx` | ELIMINAR | Excel antiguo. | Sin referencias funcionales conservadas. |
| `Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx` | ELIMINAR | Excel/transcripción antigua. | Sin referencias funcionales conservadas. |
| `data/percentiles_battelle.json` | ELIMINAR | Baremo antiguo que se regenerará. | `script.js`, `src/battelle-correction.js`, tests y validadores adaptados. |
| `data/edades_equivalentes.json` | ELIMINAR | Baremo antiguo que se regenerará. | `script.js`, `src/battelle-correction.js`, tests y validadores adaptados. |
| `data/tablas_conversion_battelle.json` | ELIMINAR | Conversiones generales antiguas. | Validadores e informes eliminados. |
| `data/fuentes.json` | ELIMINAR | Metadatos de fuentes antiguas. | Sin referencias funcionales conservadas. |
| `data/auditorias/` | ELIMINAR | Manifiestos visuales antiguos PDF/TIFF. | Informes y validadores eliminados. |
| `data/inventario_tablas.json` | ELIMINAR | Inventario antiguo de tablas PDF. | Validadores e informes eliminados. |
| `data/informe_auditoria_editorial.md`, `data/informe_extraccion.md` | ELIMINAR | Informes antiguos de extracción/auditoría. | Documentación sustituida por este estado temporal. |
| `scripts/extraer_paginas_percentiles_12_17.py` | ELIMINAR | Extractor PDF/CCITT/TIFF. | No debe seguir ejecutándose. |
| `scripts/validar_percentiles.py`, `scripts/validar_edades_equivalentes.py`, `scripts/validar_tablas.py` | ELIMINAR | Validaban datos normativos retirados. | Sustituidos por validador de limpieza. |
| `scripts/battelle_parser/`, `scripts/generar_battelle_desde_excel.py`, `scripts/validar_generado_excel.py`, `data/generado_excel/` | ELIMINAR | Parser OCR y salidas antiguas si existen. | No presentes en el árbol actual; vigilados por el validador. |
| `index.html`, `styles.css`, `script.js` | CONSERVAR | Aplicación web. | `script.js` adaptado para estado sin baremos. |
| `src/battelle-scoring.js`, `src/battelle-scales.js`, `src/battelle-state.js`, `src/battelle-correction.js` | CONSERVAR | Motor, modelo, estado y corrección. | Corrección conserva PD/basal/techo y desactiva conversiones normativas. |
| `data/items_areas_subareas.json`, `data/modelo_escalas_battelle.json`, `data/reglas_puntuacion_basal_techo.json` | CONSERVAR | 341 ítems, 22 subáreas, modelo y reglas. | Validados por scripts existentes y validador de limpieza. |
| Tests del motor, estado, persistencia, integración UI | CONSERVAR | Cobertura útil no normativa. | Ajustados solo si dependían de baremos retirados. |

## Estado temporal

La administración, la puntuación observada, el cálculo de respuestas efectivas, basal, techo, PD y agregaciones permanecen funcionales. La corrección normativa queda temporalmente desactivada: no se calculan ni muestran percentiles, edades equivalentes, z, T, CI ni ECN.

Mensaje visible esperado: “Baremos pendientes de incorporar desde las nuevas fuentes estructuradas.”

Esta rama no debe utilizarse para una corrección normativa completa hasta incorporar y validar los nuevos Excel manuales estructurados.
