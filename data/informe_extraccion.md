# Informe de extracción y auditoría del inventario de tablas Battelle

## Alcance de esta revisión

Se revisó el inventario fusionado de `Battelle_Tablas de corrección.pdf` contra las tablas oficiales N-1 a N-65 ya extraídas en `data/tablas_conversion_battelle.json`. La tarea se limitó a metadatos: número oficial, página PDF, título, finalidad, área/subárea, tramo de edad, variables de entrada, resultados, encabezados visibles, estado de normalización, confianza y observaciones. No se normalizaron los baremos completos.

## Errores corregidos

- **N-1**: se corrigió la semántica. La tabla usa como entrada el percentil **PC** y produce puntuación **z**, **T**, **CI** y **ECN**.
- **N-7, N-12, N-17 y N-22**: las tablas con encabezados **Receptiva** y **Expresiva** quedaron clasificadas como **Comunicación**.
- **N-9, N-13, N-18, N-23, N-28, N-33, N-38, N-43, N-48 y N-49**: las tablas que contienen **Interacción con el adulto**, **Expresión de sentimientos/afecto** y/o **Autoconcepto** quedaron clasificadas como **Personal-Social**.
- Se completó `pagina_pdf` y `paginas_pdf` en las tablas inventariadas, eliminando los valores `null`.
- Se corrigieron errores de extracción visibles en títulos, por ejemplo `Gentiles`/`centfes` → `centiles`, `Cl` → `CI`, `lafecto` → `/afecto`, `Autoeoncepto` → `Autoconcepto` y variantes de `conversión`.
- Se añadieron campos explícitos para `encabezados_visibles`, `nivel_confianza` y `observaciones`.

## Presencia o ausencia de N-2 y N-39

- **N-2**: ausencia confirmada en la secuencia oficial auditada. No se incorpora una entrada inventada.
- **N-39**: ausencia confirmada en la secuencia oficial auditada. No se incorpora una entrada inventada.

## Tablas o páginas que continúan dudosas

- Las tablas con `estado_actual_normalizacion: "tokens_sin_normalizar"` siguen teniendo confianza **baja** porque sus filas se conservan como tokens y no como pares de columnas explícitos.
- Las tablas con `estado_actual_normalizacion: "parcial"` siguen teniendo confianza **media** cuando no hay filas estructuradas suficientes en `data/tablas_conversion_battelle.json`.
- La revisión automatizada valida coherencia semántica y estructural, pero no sustituye la lectura humana de cada celda del baremo.

## Recuento final por finalidad

- `conversion_pd_a_percentil`: 49 tablas.
- `conversion_percentil_a_puntuaciones_tipicas`: 1 tabla.
- `criterio_screening`: 1 tabla.
- `edad_equivalente`: 12 tablas.

## Recuento por nivel de confianza

- `alta`: 3 entradas.
- `media`: 12 entradas.
- `baja`: 49 entradas.

## Validación automatizada

El validador `scripts/validar_tablas.py` comprueba:

- presencia de todas las tablas oficiales confirmadas, con N-2 y N-39 como ausencias confirmadas;
- ausencia de identificadores y números oficiales duplicados;
- `pagina_pdf` no nula y `paginas_pdf` no vacía;
- regla semántica de N-1: entrada PC y salidas z, T, CI y ECN;
- asignación de Receptiva/Expresiva a Comunicación;
- asignación de Interacción con el adulto, Expresión de sentimientos/afecto y Autoconcepto a Personal-Social;
- coherencia básica entre título, finalidad, entradas y resultados;
- estados de normalización y niveles de confianza válidos.

Las comprobaciones de localización visual y literalidad completa de encabezados se documentan como revisión manual; el script no afirma validar píxel a píxel el PDF.
