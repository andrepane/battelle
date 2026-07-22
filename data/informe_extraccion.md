# Informe de extracción y auditoría del inventario de tablas Battelle

## Alcance de esta corrección

Este commit corrige la auditoría previa del inventario de `Battelle_Tablas de corrección.pdf`. La corrección no modifica valores de baremos y se limita a metadatos: título visual confirmado, área visual confirmada, páginas localizadas, variables de entrada/salida, tokens contaminantes, confianza y validaciones automatizables.

## Criterio corregido de clasificación

La auditoría anterior usó indebidamente tokens desplazados del extractor para reclasificar tablas. Desde esta corrección, el área no se decide por palabras presentes en el bloque extraído cuando contradicen el título literal y la secuencia oficial. Los tokens sospechosos se guardan separadamente en:

- `tokens_contaminantes`;
- `posible_tabla_origen_tokens`.

La secuencia oficial aplicada a las tablas de conversión en centiles N-3 a N-52 es:

1. Personal-Social;
2. Adaptativa;
3. Motora;
4. Comunicación;
5. Cognitiva.

Por ejemplo, N-3..N-12 quedan como: N-3 Personal-Social, N-4 Adaptativa, N-5 Motora, N-6 Comunicación, N-7 Cognitiva, N-8 Personal-Social, N-9 Adaptativa, N-10 Motora, N-11 Comunicación y N-12 Cognitiva.

## Reasignaciones revertidas o corregidas

Se revisaron explícitamente N-7, N-9, N-12, N-13, N-17, N-18, N-22, N-23, N-28, N-33, N-38, N-43, N-48 y N-49. Cuando los encabezados extraídos contradicen la secuencia oficial o el título visual, quedan registrados como contaminación, no como criterio de área.

Casos principales:

- N-7, N-12, N-17 y N-22 vuelven a **Cognitiva** aunque el bloque extraído contenga `Receptiva`/`Expresiva`.
- N-9 vuelve a **Adaptativa** aunque el bloque extraído contenga tokens de Personal-Social.
- N-49 vuelve a **Adaptativa** aunque el bloque extraído contenga tokens de Personal-Social.
- Las tablas Personal-Social que ya coinciden con la secuencia se mantienen como Personal-Social.

## N-1

N-1 conserva `estado_actual_normalizacion: "normalizada"` porque sus filas PC→z/T/CI/ECN están estructuradas con encabezados explícitos y son consultables. Se eliminó la observación que sugería que no era consultable.

## N-2 y N-39

N-2 y N-39 no se declaran ausentes por el mero hecho de faltar en el JSON de extracción. En esta versión quedan documentadas como **ausencias pendientes de confirmación visual independiente**. El validador permite que no estén presentes, pero las informa como pendientes y no como ausencias confirmadas.

## Páginas y dudas pendientes

Se mantienen las páginas ya localizadas en el inventario. Las dudas pendientes se concentran en:

- confirmación visual independiente de N-2 y N-39;
- revisión manual de tablas con tokens contaminantes;
- normalización futura de las tablas que siguen en `tokens_sin_normalizar`;
- lectura celda a celda de baremos, que no forma parte de esta tarea.

## Recuento final por finalidad

- `conversion_pd_a_percentil`: 49 tablas.
- `conversion_percentil_a_puntuaciones_tipicas`: 1 tabla.
- `criterio_screening`: 1 tabla.
- `edad_equivalente`: 12 tablas.

## Recuento por nivel de confianza

- `alta`: 1 entrada.
- `media`: 18 entradas.
- `baja`: 45 entradas.

## Validación automatizada

El validador `scripts/validar_tablas.py` comprueba ahora:

- presencia de las tablas oficiales esperadas, dejando N-2 y N-39 como pendientes de confirmación visual;
- ausencia de identificadores y números oficiales duplicados;
- `pagina_pdf` no nula y `paginas_pdf` no vacía;
- campos separados `titulo_visual_confirmado`, `area_visual_confirmada`, `tokens_contaminantes` y `posible_tabla_origen_tokens`;
- regla semántica de N-1: entrada PC y salidas z, T, CI y ECN;
- área contra la secuencia oficial explícita N-3..N-52;
- documentación de origen posible cuando hay tokens contaminantes;
- coherencia básica entre título, finalidad, entradas y resultados;
- estados de normalización y niveles de confianza válidos.

El script ya no reclasifica ni falla una tabla por contener `Receptiva`, `Expresiva`, `Interacción con el adulto` o `Autoconcepto` si esos tokens están documentados como contaminación.

## Edades equivalentes N-54 a N-65

Se añadió `data/edades_equivalentes.json` como archivo independiente para las tablas de edades equivalentes N-54 a N-65, sin reemplazar todavía `data/tablas_conversion_battelle.json`.

Criterios aplicados:

- Cada correspondencia conserva el intervalo de puntuación directa, la edad equivalente en meses, los valores originales de puntuación/edad, la página PDF y la confianza.
- Los intervalos cerrados se expanden lógicamente en la validación para asegurar que cada puntuación directa corresponde a una única edad equivalente.
- Los límites abiertos (`117+`, `162+`, `672+`, etc.) conservan el valor original y usan como `puntuacion_max` el máximo teórico/documental de la escala para poder validar solapes.
- Las edades máximas expresadas como intervalos (`90-95`) se conservan en `valor_original_edad` y se normalizan por el límite inferior en `edad_equivalente_meses`.
- Las celdas con OCR dudoso o particiones visibles en la extracción quedan documentadas en notas o en `dudas_visuales`; en particular, N-54 queda marcada como tabla pendiente de transcripción visual exhaustiva por mezcla de encabezados y celdas partidas.

Comprobaciones específicas añadidas para Battelle total N-65:

- PD 386 → edad equivalente 37 meses.
- PD 421 → edad equivalente 41 meses.
- PD 436 → edad equivalente 43 meses.
- PD 464 → edad equivalente 47 meses.
- PD 537 → edad equivalente 57 meses.
- PD 562 → edad equivalente 60 meses.

El validador `scripts/validar_edades_equivalentes.py` comprueba presencia de N-54 a N-65, ausencia de intervalos solapados, orden ascendente, unicidad por puntuación directa, campos numéricos válidos, conservación de valores originales y documentación de dudas visuales.

## Corrección PR #6: estado de N-54..N-65

Se corrigió el esquema de `data/edades_equivalentes.json` para representar las edades equivalentes como intervalo (`edad_equivalente_min_meses` y `edad_equivalente_max_meses`) y no perder valores originales como `90-95`. También se añadió `puntuacion_limite_abierto` y se extendieron los límites abiertos hasta el máximo teórico de cada escala.

Máximos teóricos usados por el validador:

- Personal/Social: 170.
- Adaptativa: 118.
- Motora gruesa: 88.
- Motora fina: 76.
- Motora total: 164.
- Comunicación receptiva: 54.
- Comunicación expresiva: 64.
- Comunicación total: 118.
- Cognitiva: 112.
- Battelle total: 682.

La tabla N-56 se corrigió para cubrir la PD 51 en el intervalo original `51-53`, documentando la corrección frente al hueco detectado en la extracción previa.

Importante: N-54 no queda marcada como normalizada. Permanece en estado `pendiente_revision_visual` porque la extracción disponible mezcla encabezados, columnas y celdas partidas, y no permite una transcripción completa segura en esta corrección. En consecuencia, el bloque N-54..N-65 aún no está completo y `scripts/validar_edades_equivalentes.py` debe fallar mientras N-54 no tenga registros normalizados.

El validador se amplió para exigir registros en todas las tablas, cobertura continua desde 0 hasta el máximo teórico, ausencia de huecos y solapes, extensión correcta de límites abiertos, edades equivalentes con mínimo y máximo, conservación de valores originales, coincidencia de página con `data/inventario_tablas.json` y los seis casos conocidos de N-65.

## Alcance de aplicación: Battelle completo de 341 ítems

La aplicación implementa únicamente el flujo de evaluación completa del Battelle de 341 ítems. La prueba de screening es una modalidad abreviada independiente y no forma parte del motor de corrección principal.

Clasificación aplicada en `data/edades_equivalentes.json`:

- N-54 y N-55: `modalidad: "screening"`, `estado_proyecto: "fuera_alcance"`.
- N-56 a N-65: `modalidad: "battelle_completo"`, `estado_proyecto: "obligatoria"`.

N-54 conserva sus dudas documentadas y no se inventan registros. N-55 puede permanecer normalizada como referencia documental, pero el motor de corrección del Battelle completo no debe consumirla.

El validador de edades equivalentes ahora determina la completitud del bloque principal solo con las diez tablas obligatorias N-56..N-65. Además informa por separado el estado de las tablas de screening y mantiene las comprobaciones de cobertura continua, huecos, solapes, máximos teóricos, intervalos de edad equivalente y los seis casos conocidos de N-65.

Salida esperada del validador cuando el bloque principal está correcto:

- `Screening: fuera del alcance de esta aplicación`.
- `Battelle completo: N-56..N-65 validadas`.

## Normalización de percentiles 0-5 meses (N-3 a N-7)

Se añadió `data/percentiles_battelle.json` como archivo incremental para las conversiones PD→PC del tramo 0-5 meses, sin sustituir `data/tablas_conversion_battelle.json` ni modificar la interfaz. La lectura se hizo por páginas visualmente posicionadas del PDF para separar columnas contiguas:

- N-3, página PDF 1: Personal/Social; subáreas Interacción con el adulto, Expresión de sentimientos/afecto, Autoconcepto y puntuación total.
- N-4, página PDF 2 según inventario: Adaptativa; subáreas Atención, Comida y puntuación total.
- N-5, página PDF 3: Motora; subáreas Control muscular, Coordinación corporal, Motricidad fina, agregados Motora gruesa y Motora fina, y puntuación total.
- N-6, página PDF 4: Comunicación; subáreas Receptiva, Expresiva y puntuación total.
- N-7, página PDF 5: Cognitiva; subáreas Discriminación perceptiva, Memoria y puntuación total.

Los límites abiertos con `+` se extendieron exclusivamente hasta el máximo teórico calculado desde los ítems de la escala/subárea correspondiente. Se documentó como celda dudosa N-5 Control muscular `8-9`, porque la extracción/OCR conserva un apóstrofo junto al intervalo; se normalizó como intervalo cerrado 8-9 tras lectura visual.

Se añadió `scripts/validar_percentiles.py`, que falla ante tablas o escalas ausentes, edades distintas de 0-5 meses, huecos/solapamientos en PD, percentiles inválidos, páginas no coincidentes con el inventario, columnas no separadas o filas residuales `valores: []`.

### Corrección de límites abiertos agregados

Se corrigió el extremo superior de los intervalos abiertos (`+`) en las escalas agregadas y totales para que llegue al máximo teórico completo de la escala, calculado desde `data/items_areas_subareas.json`, y no solo a la suma de columnas visibles en el tramo 0-5 meses:

- Personal/Social total: 170.
- Adaptativa total: 118.
- Motora gruesa: 88 (Control muscular + Coordinación corporal + Locomoción).
- Motora fina: 76 (Motricidad fina + Motricidad perceptiva).
- Motora total: 164.
- Comunicación total: 118.
- Cognitiva total: 112, incluyendo todas las subáreas cognitivas del área aunque no aparezcan como columnas independientes en la tabla 0-5.

No se modificaron intervalos interiores ni percentiles transcritos. El validador ahora calcula los máximos desde el inventario de ítems, distingue subáreas individuales, agregados motores y totales de área, y exige que todo intervalo terminado en `+` alcance su máximo teórico correspondiente.

## Ampliación de percentiles 6-11 meses (N-8 a N-12)

Se añadió el tramo de edad cronológica 6-11 meses a `data/percentiles_battelle.json` sin editar el bloque validado de 0-5 meses. Las tablas normalizadas son N-8 Personal/Social, N-9 Adaptativa, N-10 Motora, N-11 Comunicación y N-12 Cognitiva, con `edad_cronologica_min_meses: 6` y `edad_cronologica_max_meses: 11` en todos los registros.

La lectura se hizo por tabla y no por reutilización de columnas del tramo anterior. En particular, N-10 incorpora la subárea Locomoción y los agregados motores completos; N-12 incorpora Razonamiento y habilidades escolares. Los límites abiertos `+` se extendieron hasta los máximos teóricos calculados desde `data/items_areas_subareas.json` para subáreas, totales y agregados motores.

Celdas dudosas documentadas:

- N-8: la extracción tokenizada comprime columnas con distinta altura; se transcribieron las secuencias visibles por escala.
- N-9: Atención, Comida y total Adaptativa tienen alturas distintas y cierres inferiores diferentes.
- N-10: Locomoción incluye una celda partida entre líneas y un percentil con coma OCR en el valor original.
- N-12: aparece un token final `12-17` contaminante del tramo siguiente; no se normalizó como registro 6-11.

El validador de percentiles ahora valida conjuntamente N-3 a N-7 para 0-5 meses y N-8 a N-12 para 6-11 meses. La validación se agrupa por tramo, tabla y escala para impedir que la cobertura de una edad tape huecos de otra, y comprueba columnas esperadas, cobertura completa, huecos, solapamientos, máximos teóricos, límites abiertos, percentiles, páginas del inventario y conservación del bloque 0-5.

### Corrección visual exhaustiva de N-10 a N-12

Se reemplazaron los intervalos artificiales de N-10, N-11 y N-12 por la transcripción fila a fila de las columnas impresas. En esta corrección no se añadieron intervalos inferidos para rellenar extremos: cada registro conserva el intervalo PD visible, y solo los intervalos con `+` se extienden hasta su máximo teórico.

Recuentos visuales por escala del tramo 6-11 meses:

| Tabla | Escala | Filas visibles esperadas | Filas transcritas | Auditoría visual completa |
| --- | --- | ---: | ---: | --- |
| N-8 | Interacción con el adulto | 12 | 12 | true |
| N-8 | Expresión de sentimientos/afecto | 9 | 9 | true |
| N-8 | Autoconcepto | 6 | 6 | true |
| N-8 | Personal/Social total | 15 | 15 | true |
| N-9 | Atención | 7 | 7 | true |
| N-9 | Comida | 11 | 11 | true |
| N-9 | Adaptativa total | 13 | 13 | true |
| N-10 | Control muscular | 7 | 7 | true |
| N-10 | Coordinación corporal | 10 | 10 | true |
| N-10 | Locomoción | 11 | 11 | true |
| N-10 | Motricidad fina | 12 | 12 | true |
| N-10 | Motora gruesa | 21 | 21 | true |
| N-10 | Motora fina | 13 | 13 | true |
| N-10 | Motora total | 22 | 22 | true |
| N-11 | Receptiva | 8 | 8 | true |
| N-11 | Expresiva | 11 | 11 | true |
| N-11 | Comunicación total | 17 | 17 | true |
| N-12 | Discriminación perceptiva | 4 | 4 | true |
| N-12 | Memoria | 6 | 6 | true |
| N-12 | Razonamiento y habilidades escolares | 4 | 4 | true |
| N-12 | Cognitiva total | 10 | 10 | true |

El validador ahora falla si los recuentos `filas_visibles_esperadas` y `filas_transcritas` no coinciden, si falta `auditoria_visual_completa: true`, si una escala mantiene `confianza: baja`, o si una celda dudosa documentada no tiene un registro correspondiente en el JSON.

## Ampliación de percentiles 12-17 meses (N-13 a N-17)

Se completó el tramo de edad cronológica 12-17 meses en `data/percentiles_battelle.json` con `edad_cronologica_min_meses: 12` y `edad_cronologica_max_meses: 17` en todos los registros. Las páginas se localizaron recorriendo el árbol `/Pages` real del PDF y se corrigió `data/inventario_tablas.json` cuando el inventario previo no coincidía con el título visible: N-13 queda en la página humana 10, N-14 en la 11, N-15 en la 12, y N-16/N-17 comparten visualmente la página humana 13 porque la misma imagen muestra ambos títulos.

La lectura se auditó sobre los flujos renderizables del PDF y la imagen de fondo CCITT de cada página; no se dependió de `data/tablas_conversion_battelle.json`, ni se modificó ese archivo. Para dejar el procedimiento reproducible se añadió `scripts/extraer_paginas_percentiles_12_17.py`, que localiza las páginas desde `data/inventario_tablas.json`, relaciona tabla → página PDF → objeto de página → XObject de imagen → TIFF reproducible, extrae las imágenes CCITT de alta resolución como TIFF y vuelca `data/auditorias/percentiles_12_17_manifest.json` con `pagina_pdf_indice_cero`, `pagina_pdf_numero_humano`, `pagina_impresa`, hashes del PDF, hashes de flujos de imagen, dimensiones y recuentos visuales independientes por escala. El manifiesto ya no copia `registros_json`; el validador los calcula desde `data/percentiles_battelle.json` y los compara contra `filas_visibles_independientes`. Se mantuvieron intactos los bloques 0-5 y 6-11 meses, protegidos por checksum en `scripts/validar_percentiles.py`.

Columnas normalizadas del tramo 12-17 meses:

| Tabla | Escala | Filas visibles esperadas | Filas transcritas | Auditoría visual completa | Confianza |
| --- | --- | ---: | ---: | --- | --- |
| N-13 | Interacción con el adulto | 19 | 19 | true | alta |
| N-13 | Expresión de sentimientos/afecto | 14 | 14 | true | alta |
| N-13 | Autoconcepto | 9 | 9 | true | alta |
| N-13 | Interacción con los compañeros | 14 | 14 | true | alta |
| N-13 | Personal/Social total | 26 | 26 | true | alta |
| N-14 | Atención | 7 | 7 | true | alta |
| N-14 | Comida | 11 | 11 | true | alta |
| N-14 | Vestido | 9 | 9 | true | alta |
| N-14 | Adaptativa total | 20 | 20 | true | alta |
| N-15 | Coordinación corporal | 8 | 8 | true | alta |
| N-15 | Locomoción | 13 | 13 | true | alta |
| N-15 | Motricidad fina | 7 | 7 | true | alta |
| N-15 | Motricidad perceptiva | 11 | 11 | true | alta |
| N-15 | Motora gruesa | 19 | 19 | true | alta |
| N-15 | Motora fina | 13 | 13 | true | alta |
| N-15 | Motora total | 26 | 26 | true | alta |
| N-16 | Receptiva | 9 | 9 | true | alta |
| N-16 | Expresiva | 13 | 13 | true | alta |
| N-16 | Comunicación total | 17 | 17 | true | alta |
| N-17 | Discriminación perceptiva | 6 | 6 | true | alta |
| N-17 | Memoria | 5 | 5 | true | alta |
| N-17 | Razonamiento y habilidades escolares | 5 | 5 | true | alta |
| N-17 | Desarrollo conceptual | 6 | 6 | true | alta |
| N-17 | Cognitiva total | 12 | 12 | true | alta |

Se transcribieron 299 registros PD-PC para N-13..N-17 y cada escala quedó con `estado: normalizada`. El manifiesto confirma las celdas llamativas N-14 Atención `0-12'`, N-15 Coordinación corporal `16+`→PC 81, N-17 Memoria `10+`→PC 95 y N-17 Razonamiento y habilidades escolares `5+`→PC 98; el apóstrofo de `0-12'` se conserva literalmente como marca impresa/OCR, no como límite abierto. Los intervalos abiertos terminados en `+` se extendieron exclusivamente hasta el máximo teórico calculado desde `data/items_areas_subareas.json`; los demás intervalos conservan sus límites impresos. No se añadieron intervalos artificiales ni se usaron columnas resumidas con solo PC 1 inferior y un límite superior.

El validador de percentiles valida ahora por separado 0-5, 6-11 y 12-17 meses; protege por checksum los bloques 0-5 y 6-11; exige coincidencia entre filas visibles y filas transcritas; exige auditoría visual completa; rechaza confianza baja; comprueba celdas dudosas; y valida páginas, percentiles, cobertura, huecos, solapamientos y extensión correcta de límites abiertos.
