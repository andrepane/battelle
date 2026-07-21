# Informe de validación de extracción Battelle

## Fuentes
- El proyecto usa exclusivamente los dos PDF disponibles: `Cuaderno anotación Battelle buena calidad.pdf` y `Battelle_Tablas de corrección.pdf`.
- No se considera incidencia la ausencia de un tercer PDF.

## Cuaderno de anotación
- El cuaderno no contiene texto seleccionable fiable; se extrajeron/consultaron imágenes JPEG embebidas y se realizó lectura visual asistida sobre páginas renderizadas del cuaderno.
- Ítems estructurados transcritos: 341.
- Cobertura por área:
  - Personal/Social: 85 ítems.
  - Adaptativa: 59 ítems.
  - Motora: 82 ítems.
  - Comunicación: 59 ítems.
  - Cognitiva: 56 ítems.
- Se retiraron de `data/items_areas_subareas.json` los criterios genéricos 2/1/0 que estaban repetidos dentro de cada ítem, por no ser transcripción documental específica del cuaderno.
- Las reglas generales de puntuación basal/techo se conservan separadas en `data/reglas_puntuacion_basal_techo.json`.
- Regla global leída visualmente: UMBRAL = puntuación 2 en dos ítems consecutivos de un nivel de edad; TECHO = puntuación 0 en dos ítems consecutivos de un nivel de edad.

## Procedencia de la extracción visual
- `obj43`, `obj49`, `obj55` y `obj61`: área Personal/Social.
- `obj61` y `obj67`: área Adaptativa.
- `obj73`, `obj79` y `obj85`: área Motora.
- `obj91` y `obj97`: área Comunicación.
- `obj103` y `obj109`: área Cognitiva.

## Validación automática
Se añadió `scripts/validar_items.py` para comprobar automáticamente:
- total exacto de 341 ítems;
- recuento esperado por área;
- códigos duplicados;
- saltos en la numeración por prefijo (`PS`, `A`, `M`, `CM`, `CG`);
- campos obligatorios vacíos;
- coincidencia entre los ítems y las subáreas declaradas.

Resultado de `python scripts/validar_items.py`:

```text
Validación Battelle
Total ítems: 341
Recuentos por área:
  Personal/Social: 85
  Adaptativa: 59
  Motora: 82
  Comunicación: 59
  Cognitiva: 56
OK: total, recuentos, códigos, campos obligatorios y subáreas coinciden.
```

## Tablas de corrección
- No se modificaron las tablas de conversión en esta pasada.
- Se mantienen los registros JSON existentes con `encabezados_columnas`, `encabezados_filas` y `filas`.

## Limitaciones pendientes antes de tocar la interfaz
- Aunque el recuento y la numeración de ítems ya están completos, conviene realizar una segunda revisión editorial contra el PDF original antes de exponer los datos en la interfaz.
- No se modificaron `index.html`, `styles.css` ni `script.js`.
