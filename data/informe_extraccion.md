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

## Inventario de tablas de corrección (fase 1)

Se añadió `data/inventario_tablas.json` como inventario completo de las 64 entradas extraídas desde `Battelle_Tablas de corrección.pdf` y contrastadas con `data/tablas_conversion_battelle.json`.

### Criterio de normalización aplicado

Una tabla se marca como `normalizada` solo cuando sus filas son relaciones explícitas con encabezados utilizables por código. Las entradas que conservan filas del tipo `{"valores": [...]}` se clasifican como `tokens_sin_normalizar`, porque aún obligan a deducir posiciones dentro de una lista. Las entradas sin filas o sin encabezados suficientes se clasifican como `parcial`.

### Resultado cuantitativo

- Entradas inventariadas: 64.
- Tablas oficiales detectadas por numeración `N-*`: 63.
- Tablas realmente normalizadas: 1 (`N-1`).
- Tablas parciales: 12.
- Tablas con tokens sin normalizar: 51.

### Numeración y coherencia

- Números oficiales ausentes en la extracción actual: `N-2`, `N-39`.
- Identificadores oficiales duplicados: ninguno detectado.
- Entrada sin número oficial: `tabla_001` (`preámbulo`).
- Salto incoherente detectado: `tabla_039` aparece como `N-40`, por lo que `N-39` no está representada como tabla independiente en el JSON actual.

### Tablas que necesitan lectura visual

Necesitan lectura visual todas las entradas salvo la revisión de estructura ya explícita de `N-1`; aun así `N-1` queda marcada para comprobación visual de página/título porque la extracción actual no conserva página del PDF. En concreto: `tabla_001`, `N-1`, `N-3`, `N-4`, `N-5`, `N-6`, `N-7`, `N-8`, `N-9`, `N-10`, `N-11`, `N-12`, `N-13`, `N-14`, `N-15`, `N-16`, `N-17`, `N-18`, `N-19`, `N-20`, `N-21`, `N-22`, `N-23`, `N-24`, `N-25`, `N-26`, `N-27`, `N-28`, `N-29`, `N-30`, `N-31`, `N-32`, `N-33`, `N-34`, `N-35`, `N-36`, `N-37`, `N-38`, `N-40`, `N-41`, `N-42`, `N-43`, `N-44`, `N-45`, `N-46`, `N-47`, `N-48`, `N-49`, `N-50`, `N-51`, `N-52`, `N-53`, `N-54`, `N-55`, `N-56`, `N-57`, `N-58`, `N-59`, `N-60`, `N-61`, `N-62`, `N-63`, `N-64`, `N-65`.

### Bloques de trabajo propuestos

1. **Bloque A — N-1**: revisar la tabla de conversión de centiles a puntuaciones típicas (`z`, `T`, `CI`, `ECN`) y completar metadatos visuales.
2. **Bloque B — Percentiles por edad y área/subárea**: normalizar las tablas tokenizadas de percentiles (`N-4`, `N-5`, `N-7`, `N-9`, `N-10`, `N-12`, `N-13`, `N-14`, `N-15`, `N-17`, `N-18`, `N-19`, `N-20`, `N-22`, `N-23`, `N-24`, `N-25`, `N-27`, `N-28`, `N-29`, `N-30`, `N-32`, `N-33`, `N-34`, `N-35`, `N-36`, `N-37`, `N-38`, `N-40`, `N-42`, `N-43`, `N-44`, `N-45`, `N-47`, `N-48`, `N-49`, `N-50`, `N-51`, `N-52`).
3. **Bloque C — Edades equivalentes**: normalizar intervalos de puntuación directa y límites abiertos en `N-54` a `N-65`.
4. **Bloque D — Screening**: normalizar criterios de `N-53` y separar variables de edad/puntuación por área.
5. **Bloque E — Relectura/OCR visual prioritaria**: resolver entradas parciales o vacías (`tabla_001`, `N-3`, `N-6`, `N-8`, `N-11`, `N-16`, `N-21`, `N-26`, `N-31`, `N-41`, `N-46`, `N-58`) y confirmar las ausencias `N-2` y `N-39`.
