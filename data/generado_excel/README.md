# Salidas generadas del parser Battelle

Este directorio conserva solo documentación y resúmenes pequeños. Las salidas completas (`pd_percentil.json/csv`, `n1_conversion_pc.*`, inventario completo, incidencias completas y auditorías OCR) son reproducibles y se generan por defecto en `tmp/battelle_generado_excel/`, que está ignorado por Git para mantener el PR revisable.

## Regeneración local

```bash
python scripts/generar_battelle_desde_excel.py --output-dir tmp/battelle_generado_excel
python scripts/validar_generado_excel.py --output-dir tmp/battelle_generado_excel
```

También puede indicarse cualquier otro destino mediante `--output-dir`.

## Estado de la generación de referencia

- Tablas esperadas: 52.
- Tablas localizadas por la versión inicial del parser: 42.
- Registros PD→percentil generables en la salida completa inicial: 4555.
- Registros protegidos N-3..N-12 procedentes del v4: 461.
- Incidencias estructuradas de referencia: 57.
- Checksum protegido N-3..N-12: `46fa96209bafccd9b1070da0b2617908f3e34bb0c317ebb3cc242badca45999d`.

Los registros automáticos no se versionan completos y no sustituyen a `data/percentiles_battelle.json`. Ninguna fila nueva debe tratarse como `REVISADO_VISUALMENTE` hasta completar la validación visual y semántica.
