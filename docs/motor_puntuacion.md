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

## Qué se ha retirado

Se retiraron del árbol actual las fuentes antiguas: documentos PDF, hojas Excel derivadas, salidas OCR, extractores PDF/imagen, auditorías visuales, inventarios de tablas, informes de extracción y JSON normativos anteriores. La historia Git conserva esos archivos en commits previos; el respaldo local de esta limpieza queda documentado en `docs/limpieza_fuentes.md`.

## Estado temporal sin baremos

La aplicación arranca sin datos normativos activos. La corrección válida no calcula ni muestra percentiles, edades equivalentes, z, T, CI ni ECN. En su lugar, la interfaz y el módulo de corrección muestran el aviso:

> Baremos pendientes de incorporar desde las nuevas fuentes estructuradas.

No existen fallbacks antiguos ni tablas manuales incrustadas en JavaScript. Esta versión no debe utilizarse para una corrección normativa completa.

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

La implementación procede solo de las reglas disponibles en `data/reglas_puntuacion_basal_techo.json`: basal con dos puntuaciones `2` consecutivas en un mismo nivel de edad; techo con dos puntuaciones `0` consecutivas en un mismo nivel de edad. No cruza subáreas ni niveles de edad, y no usa puntuaciones derivadas para detectar nuevas parejas.

Confirmado el basal, los ítems anteriores no administrados de la subárea reciben `2` derivado. Confirmado el techo, los ítems posteriores no administrados reciben `0` derivado. Las respuestas observadas no se sobrescriben.

## PD parcial y PD válida

Cada subárea o escala informa `pd_parcial` como suma de ítems con puntuación efectiva. La PD puede ser `null` aunque exista `pd_parcial` si falta algún ítem, si la subárea requiere revisión o si un agregado depende de una subárea en revisión. La PD solo es válida cuando todos los ítems que componen la escala están observados o derivados y no hay inconsistencias dependientes.

## Fuentes futuras

Las próximas fuentes autorizadas se incorporarán en `fuentes/` como Excel manuales estructurados, separados por percentiles, edades equivalentes, conversiones generales y screening. El screening seguirá separado del Battelle completo.
