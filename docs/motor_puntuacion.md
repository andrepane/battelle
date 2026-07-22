# Motor de puntuación directa Battelle

Este documento describe el motor independiente de interfaz para cargar los 341 ítems del Battelle desde `data/items_areas_subareas.json`, normalizarlos y calcular puntuaciones directas (PD) observadas o derivadas. No modifica la interfaz ni usa DOM, `localStorage`, percentiles, edades equivalentes, puntuaciones típicas, z, T, CI ni ECN.

## Esquema real de los ítems

El JSON contiene metadatos (`source`, `extraction_method`, `reglas_globales`, `validation`), una lista resumida `areas` con nombres de áreas, subáreas y códigos, y un listado detallado `items`. Cada ítem detallado contiene `area`, `subarea`, `codigo`, `rango_edad_meses`, `enunciado`, `fuente` y `confianza`. El motor valida que la lista resumida y el listado detallado correspondan exactamente.

## Estados de respuesta

- `no_administrado`: `puntuacion: null`, sin origen; nunca se trata como cero.
- `administrado`: puntuación observada `0`, `1` o `2`, con `origen: "observado"`.
- `derivado`: crédito `2` por basal o `0` por techo, con `origen: "basal"` o `"techo"`.

Las respuestas observadas del examinador se clonan y se mantienen separadas de las respuestas efectivas derivadas.

## Basal y techo

La implementación procede solo de las reglas disponibles en `data/reglas_puntuacion_basal_techo.json` y el cuaderno: basal con dos puntuaciones `2` consecutivas en un mismo nivel de edad; techo con dos puntuaciones `0` consecutivas en un mismo nivel de edad. No cruza subáreas ni niveles de edad, y no usa puntuaciones derivadas para detectar nuevas parejas.

Confirmado el basal, los ítems anteriores no administrados de la subárea reciben `2` derivado. Confirmado el techo, los ítems posteriores no administrados reciben `0` derivado. Las respuestas observadas no se sobrescriben; contradicciones anteriores al basal o posteriores al techo generan advertencias estructuradas.

## PD parcial y PD válida

Cada subárea o escala informa `pd_parcial` como suma de ítems con puntuación efectiva. Si falta cualquier ítem, `pd` es `null`, `completa` es `false` y se listan `pendientes`. La PD solo es válida cuando todos los ítems que componen la escala están observados o derivados.

## Composición de escalas

`data/modelo_escalas_battelle.json` declara subáreas y agregados sin duplicar ítems: Personal/Social total, Adaptativa total, Motora gruesa (Control muscular, Coordinación corporal, Locomoción), Motora fina (Motricidad fina, Motricidad perceptiva), Motora total, Comunicación receptiva, Comunicación expresiva, Comunicación total, Cognitiva total y Battelle total. Los máximos se calculan como número de ítems por 2.

## Limitaciones actuales

El motor calcula solo puntuaciones directas, agregados, completitud, basales, techos y advertencias. Todavía no convierte PD a percentiles, edades equivalentes ni puntuaciones típicas, y todavía no está integrado con la interfaz de usuario.
