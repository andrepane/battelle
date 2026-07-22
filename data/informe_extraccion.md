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
