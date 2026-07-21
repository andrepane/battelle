# Informe de validación de extracción Battelle

## Fuentes
- El proyecto usa exclusivamente los dos PDF disponibles: `Cuaderno anotación Battelle buena calidad.pdf` y `Battelle_Tablas de corrección.pdf`.
- No se considera incidencia la ausencia de un tercer PDF.

## Cuaderno de anotación
- El cuaderno no contiene texto seleccionable fiable; se extrajeron imágenes JPEG embebidas y se realizó lectura visual asistida.
- Ítems estructurados transcritos: 129.
- Códigos duplicados detectados: ninguno en los ítems transcritos.
- Campos obligatorios vacíos detectados: ninguno en los ítems transcritos.
- Regla global leída visualmente: UMBRAL = puntuación 2 en dos ítems consecutivos de un nivel de edad; TECHO = puntuación 0 en dos ítems consecutivos de un nivel de edad.

## Tablas de corrección
- Se convirtieron las secciones detectadas a registros JSON con `encabezados_columnas`, `encabezados_filas` y `filas`.
- Cuando los encabezados de una tabla no pudieron inferirse con seguridad desde el flujo textual del PDF, la fila conserva la secuencia de valores en `valores` y queda marcada como limitación de normalización.

## Validación pendiente / valores dudosos
- La extracción visual todavía está marcada como incompleta porque el entorno no dispone de OCR automático instalable: `pip install` y `apt-get` fallaron por respuestas 403 del proxy.
- Quedan subáreas/páginas del cuaderno por transcribir antes de modificar `index.html`, `styles.css` o `script.js`.
- Las tablas complejas de corrección requieren una segunda pasada de verificación visual para confirmar cobertura completa de filas, columnas e intervalos de puntuación.
