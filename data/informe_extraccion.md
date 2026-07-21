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
