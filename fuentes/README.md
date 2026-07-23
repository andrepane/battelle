# Fuentes Excel normativas Battelle

Este directorio contiene únicamente las fuentes Excel manuales y corregidas aportadas para la futura generación normativa. Todavía **no** se han generado los JSON activos ni se ha modificado la aplicación, la interfaz ni el motor.

## Estructura final

- `fuentes/percentiles/00-05/` … `fuentes/percentiles/84-95/`: tablas N-3..N-52, cinco tablas por tramo cronológico.
- `fuentes/edades_equivalentes/`: tablas N-56..N-64 de edades equivalentes por escala. Un libro puede contener más de una hoja normativa si así llegó la fuente.
- `fuentes/conversiones_generales/`: N-1, N-2 y N-65.
- `fuentes/screening/`: reservado para fuentes que declaren expresamente screening. N-2 no pertenece a screening.
- `fuentes/inventario_fuentes.json`: inventario con nombre original/final, SHA-256, tabla, categoría, destino, hojas, registros y estado.

## Categorías y recuentos

- Percentiles por área y tramo cronológico: 50 archivos.
- Conversión Battelle total a centil por edad (N-2): 1 archivo.
- Conversión PC a z, T, CI y ECN (N-1): 1 archivo.
- Edades equivalentes por escala (N-56..N-64): 8 archivos.
- Edad equivalente Battelle total (N-65): 1 archivo, ubicado solo en `conversiones_generales/`.
- Screening: 0 archivos.

## Formato esperado

### Percentiles N-3..N-52

Columnas: `edad_min_meses`, `edad_max_meses`, `tabla`, `area`, `escala`, `pd_original`, `pd_min`, `pd_max`, `limite_superior_abierto`, `percentil`, `fuente`.

### N-1

99 registros de PC 1–99 con columnas posicionales PC, z, T, CI y ECN.

### N-2

Filas por tramo cronológico con `rango_edad`, `pd_original`, `pd_min`, `pd_max`, `limite_superior_abierto` y `centil`. Es Battelle total para todas las edades cronológicas; no es screening.

### N-56..N-65

Columnas de tabla/ámbito, intervalo de PD, límites abiertos, edad equivalente mínima/máxima y puntuación máxima. N-65 debe tener puntuación máxima 682.

## Reglas para añadir o corregir fuentes

1. No editar los Excel en este repositorio salvo sustitución completa por una fuente manual corregida.
2. Añadir el archivo al destino correspondiente con nombre normalizado que empiece por `N-x`.
3. Actualizar `fuentes/inventario_fuentes.json` con SHA-256 nuevo, origen, destino, hojas y registros.
4. Ejecutar `scripts/validar_fuentes_excel.py` y documentar cualquier incidencia estructural.
5. Mantener separado cualquier material de screening en `fuentes/screening/`; no clasificar N-2 como screening.
6. No generar JSON activos hasta una tarea posterior explícita.
