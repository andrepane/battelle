# Informe de auditoría editorial visual de ítems Battelle

Fecha de auditoría: 2026-07-21.

Archivo auditado: `data/items_areas_subareas.json`.
Fuente visual revisada: `Cuaderno anotación Battelle buena calidad.pdf`, mediante extracción local de las 15 imágenes JPEG embebidas del PDF y revisión visual de las páginas del cuaderno.

## Alcance y criterios

- Se mantuvo el total de 341 ítems: no se añadió ni se eliminó ningún registro.
- No se modificó la interfaz de la aplicación.
- Se revisaron visualmente los enunciados, rangos de edad y subáreas contra las páginas originales disponibles en el cuaderno.
- Se comprobaron signos, cifras y unidades visibles, con atención especial a comillas, barras, rangos de meses y expresiones con números.
- Se revisaron duplicados textuales exactos en el JSON.
- La confianza visual se ajustó según legibilidad real:
  - `visual_alta`: texto claro en la página fuente.
  - `visual_media`: texto legible, pero con mayor cautela editorial por renglón partido, enunciado largo o densidad visual de la línea.
  - `visual_dudosa`: reservado para texto que no pudiera confirmarse con seguridad; no se dejó ningún caso en esta categoría tras la revisión.

## Correcciones realizadas

1. Se actualizó la distribución de `confianza` para no clasificar automáticamente todos los registros como `visual_alta`.
   - Resultado: 328 registros `visual_alta`, 13 registros `visual_media` y 0 registros `visual_dudosa`.
2. Se añadieron metadatos de auditoría en `validation.auditoria_editorial_2026_07_21`, incluyendo total verificado, conteo de confianza y nota de que no se añadieron ni eliminaron ítems.
3. Se documentó explícitamente el único duplicado textual exacto confirmado: `CG 19`, `CM 20` y `CM 25` comparten literalmente el enunciado `Recuerda hechos de una historia contada.`.

## Confirmaciones relevantes

- Total de ítems confirmado: 341.
- Los códigos revisados especialmente mantienen su enunciado tal como aparece visualmente:
  - `CG 19`: `Recuerda hechos de una historia contada.`
  - `CM 20`: `Recuerda hechos de una historia contada.`
  - `CM 25`: `Recuerda hechos de una historia contada.`
- La duplicación anterior no parece ser un error de transcripción en el JSON: aparece así en las páginas originales revisadas, tanto en el área Cognitiva / Memoria como en Comunicación / Receptiva.
- No se encontraron otros duplicados textuales exactos entre los 341 enunciados.

## Ítems con confianza visual media

Se dejaron como `visual_media` por cautela editorial, no porque haya una corrección textual pendiente:

- `PS 5`: enunciado partido en dos líneas.
- `PS 11`: enunciado partido en dos líneas.
- `PS 22`: enunciado partido en dos líneas.
- `CG 10`: enunciado partido en dos líneas.
- `CM 8`: lista de conceptos y cierre de comillas en segunda línea.
- `CM 12`: enunciado partido y comillas españolas.
- `CM 13`: enunciado partido, signos y enumeración interrogativa.
- `CM 14`: enunciado largo partido en dos líneas.
- Además, otros enunciados largos del archivo quedaron en `visual_media` por el mismo criterio de revisión conservadora.

## Dudas pendientes

- No quedan dudas textuales pendientes tras la revisión visual disponible.
- No obstante, los registros `visual_media` deben considerarse candidatos prioritarios si en el futuro se contrasta contra una edición impresa distinta o un escaneo de mayor resolución.

## Nota metodológica

La auditoría se realizó sobre la calidad visual disponible del PDF local. Las páginas son imágenes escaneadas, por lo que la confianza refleja legibilidad visual de esa fuente, no una capa OCR textual nativa.
