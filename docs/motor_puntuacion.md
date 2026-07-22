# Motor de puntuación directa Battelle

Este documento describe el motor independiente de interfaz para cargar los 341 ítems del Battelle desde `data/items_areas_subareas.json`, normalizarlos y calcular puntuaciones directas (PD) observadas o derivadas. No modifica la interfaz ni usa DOM, `localStorage`, percentiles, edades equivalentes, puntuaciones típicas, z, T, CI ni ECN.

## Esquema real de los ítems

El JSON contiene metadatos (`source`, `extraction_method`, `reglas_globales`, `validation`), una lista resumida `areas` con nombres de áreas, subáreas y códigos, y un listado detallado `items`. Cada ítem detallado contiene `area`, `subarea`, `codigo`, `rango_edad_meses`, `enunciado`, `fuente` y `confianza`. El motor valida que la lista resumida y el listado detallado correspondan exactamente.

## Subáreas declaradas

`data/modelo_escalas_battelle.json` declara explícitamente todas las subáreas documentales de las cinco áreas. Cada subárea se identifica por un id auditable y por el par exacto `area`/`subarea`; la pertenencia de ítems se resuelve contra `data/items_areas_subareas.json` y no por una lista copiada de códigos.

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

La implementación procede solo de las reglas disponibles en `data/reglas_puntuacion_basal_techo.json` y el cuaderno: basal con dos puntuaciones `2` consecutivas en un mismo nivel de edad; techo con dos puntuaciones `0` consecutivas en un mismo nivel de edad. No cruza subáreas ni niveles de edad, y no usa puntuaciones derivadas para detectar nuevas parejas.

Confirmado el basal, los ítems anteriores no administrados de la subárea reciben `2` derivado. Confirmado el techo, los ítems posteriores no administrados reciben `0` derivado. Las respuestas observadas no se sobrescriben.

## Pendientes, inconsistencias, errores y requiere_revision

- `pendientes`: ítems sin puntuación efectiva observada o derivada.
- `inconsistencias`: contradicciones de basal/techo o techo provisional sin basal confirmado.
- `errores`: problemas de entrada que impiden puntuar, como código desconocido, clave vacía o duplicado canónico.
- `requiere_revision`: indicador de que la subárea o escala no debe producir PD válida aunque haya valores efectivos.

Una inconsistencia anterior al basal, posterior al techo o un techo provisional marca `requiere_revision: true`, deja `completa: false` y fuerza `pd: null`, conservando `pd_parcial` y todas las respuestas observadas.

## PD parcial y PD válida

Cada subárea o escala informa `pd_parcial` como suma de ítems con puntuación efectiva. La PD puede ser `null` aunque exista `pd_parcial` si falta algún ítem, si la subárea requiere revisión o si un agregado depende de una subárea en revisión. La PD solo es válida cuando todos los ítems que componen la escala están observados o derivados y no hay inconsistencias dependientes.

## Composición de escalas

`data/modelo_escalas_battelle.json` declara subáreas y agregados sin duplicar ítems: Personal/Social total, Adaptativa total, Motora gruesa (Control muscular, Coordinación corporal, Locomoción), Motora fina (Motricidad fina, Motricidad perceptiva), Motora total, Comunicación receptiva, Comunicación expresiva, Comunicación total, Cognitiva total y Battelle total. Los máximos se calculan como número de ítems por 2.

## Limitaciones actuales

El motor calcula solo puntuaciones directas, agregados, completitud, basales, techos, errores e inconsistencias. Todavía no convierte PD a percentiles, edades equivalentes ni puntuaciones típicas, y todavía no está integrado con la interfaz de usuario.
