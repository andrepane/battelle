# Motor de puntuación directa Battelle

Este documento describe el motor independiente de interfaz para cargar los 341 ítems del Battelle desde `data/items_areas_subareas.json`, normalizarlos y calcular puntuaciones directas (PD) observadas o derivadas. No modifica los 341 ítems, las 22 subáreas, la composición de escalas, las reglas 0/1/2, basal, techo, cálculo de PD ni persistencia.

## Qué permanece funcional

- Administración del Battelle completo desde la aplicación web.
- Creación de una “Nueva Battelle”.
- Guardado local de respuestas observadas y observaciones.
- Cálculo de respuestas efectivas.
- Aplicación de basal y techo.
- Puntuaciones directas parciales y válidas.
- Agregaciones de subáreas y escalas principales.
- Validación de los 341 ítems, las 22 subáreas, el modelo de escalas y las reglas de puntuación.

## Fuentes normativas actuales

Las fuentes autorizadas están estructuradas en hojas Excel dentro de `fuentes/`. A partir de ellas se generan los JSON de `data/` usados por la aplicación para percentiles, edades equivalentes y conversiones generales. Las tablas no están incrustadas manualmente en JavaScript.

La aplicación realiza la corrección normativa completa y puede calcular, según la escala correspondiente, percentiles, edades equivalentes, z, T, CI y ECN. Los metadatos e incidencias de los baremos quedan registrados en `data/baremos_metadata.json` y `data/baremos_incidencias.json`.

Los scripts de validación comprueban la estructura y coherencia de las fuentes, la correspondencia de las tablas generadas y la ausencia de fuentes normativas antiguas o duplicadas fuera de las ubicaciones autorizadas.

## Esquema real de los ítems

El JSON contiene metadatos, una lista resumida `areas` con nombres de áreas, subáreas y códigos, y un listado detallado `items`. Cada ítem detallado contiene `area`, `subarea`, `codigo`, `rango_edad_meses`, `enunciado`, `fuente` y `confianza`. El motor valida que la lista resumida y el listado detallado correspondan exactamente.

## Subáreas declaradas

`data/modelo_escalas_battelle.json` declara explícitamente todas las subáreas documentales de las cinco áreas. Cada subárea se identifica por un id auditable y por el par exacto `area`/`subarea`; la pertenencia de ítems se resuelve contra `data/items_areas_subareas.json`.

Los validadores comprueban que cada subárea documental aparezca exactamente una vez, que no existan subáreas inventadas, que la unión de subáreas produzca exactamente 341 códigos canónicos y que los agregados se construyan desde áreas o subáreas válidas sin ocultar ausencias por el total Battelle.

## Validación de códigos de respuesta

Antes de puntuar, el motor construye el conjunto de los 341 códigos canónicos válidos. Cada clave de respuesta se normaliza mediante `normalizeItemCode()`. Se rechazan códigos desconocidos como `PS999`, códigos mal formados, códigos de otra prueba, claves vacías y duplicados canónicos como `PS1` junto con `PS 1`.

`scoreAssessment()` usa errores estructurados: si hay un error de entrada devuelve `errores` y no produce puntuaciones ni respuestas efectivas. Las funciones internas pueden lanzar excepciones de validación, pero la API principal las captura en ese formato.

## Estados de respuesta

- `no_administrado`: `puntuacion: null`, sin origen; nunca se trata como cero.
- `administrado`: puntuación observada `0`, `1` o `2`, con `origen: "observado"`.
- `derivado`: crédito `2` por basal o `0` por techo, con `origen: "basal"` o `"techo"`.

Las respuestas observadas del examinador se clonan y se mantienen separadas de las respuestas efectivas derivadas. Las claves desconocidas no se añaden a `respuestas_efectivas`.

## Basal y techo

Las evaluaciones conservan de forma inmutable la versión del motor con la que fueron creadas. `legacy-v1` y `manual-v2` mantienen exactamente sus reglas históricas. Las evaluaciones nuevas usan `manual-v3`: en el nivel inicial correspondiente a la edad se busca una pareja de puntuaciones `2` consecutivas; si no aparece, se completan todos sus ítems y se retrocede. En cada nivel inferior el basal solo queda establecido cuando todos sus ítems obtienen `2`. El techo exige dos puntuaciones `0` consecutivas dentro del mismo nivel de edad. Ninguna versión usa respuestas derivadas para detectar nuevas reglas.

La edad efectiva de la evaluación se entrega explícitamente al motor `manual-v3`; no se deduce del orden de introducción de las respuestas. Los seguimientos nuevos utilizan la versión vigente, mientras que su evaluación de referencia se reconstruye siempre con la versión que tenga guardada.

Confirmado el basal, los ítems anteriores no administrados de la subárea reciben `2` derivado. Confirmado el techo, los ítems posteriores no administrados reciben `0` derivado. Las respuestas observadas no se sobrescriben.

## PD parcial y PD válida

Cada subárea o escala informa `pd_parcial` como suma de ítems con puntuación efectiva. La PD puede ser `null` aunque exista `pd_parcial` si falta algún ítem, si la subárea requiere revisión o si un agregado depende de una subárea en revisión. La PD solo es válida cuando todos los ítems que componen la escala están observados o derivados y no hay inconsistencias dependientes.

## Organización de las fuentes

Las fuentes se mantienen separadas por percentiles, edades equivalentes, conversiones generales y screening. El screening permanece separado del Battelle completo. Cualquier actualización normativa debe realizarse en las hojas estructuradas de `fuentes/`, regenerar los JSON correspondientes y superar todos los validadores antes de publicarse.
