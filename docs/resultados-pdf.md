# Resultados clínicos y PDF

La vista y el PDF consumen el mismo `buildResultTableModel`. Los nombres de subárea son los
canónicos de `modelo_escalas_battelle.json`; solo los rótulos agregados se presentan en mayúsculas
para expresar su jerarquía clínica. Cada PC válido (percentil de N-3…N-52 o centil N-2 para el total)
se busca de forma exacta en N-1; una ausencia o ambigüedad produce `—` y conserva el error en el
modelo técnico.

La correspondencia real verificada en `edades_equivalentes.json` es: N-56 Personal/Social total,
N-57 Adaptativa total, N-58 Motora gruesa, N-59 Motora fina, N-60 Motora total, N-61 Comunicación
receptiva, N-62 Comunicación expresiva, N-63 Comunicación total, N-64 Cognitiva total y N-65
Battelle total. Esta correspondencia difiere de la lista orientativa del encargo en N-59…N-64; se
respeta el inventario normativo validado y no se cambió ningún JSON normativo.

El exportador local es un módulo PDF pequeño, determinista y sin dependencias ni red. Se eligió en
lugar de un servicio externo para que ningún dato clínico abandone el navegador y para conservar la
arquitectura estática. Produce A4 horizontal, pagina la tabla y repite encabezados. No usa
`window.print()`.
