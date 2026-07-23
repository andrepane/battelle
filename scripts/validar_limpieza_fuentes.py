#!/usr/bin/env python3
from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
errors=[]
def fail(m): errors.append(m)
for p in ROOT.rglob('*'):
    if '.git' in p.parts or 'node_modules' in p.parts: continue
    rel=p.relative_to(ROOT).as_posix(); low=rel.lower()
    if p.is_file() and low.endswith('.pdf'): fail(f'PDF versionado: {rel}')
    if p.is_file() and low.endswith(('.xls','.xlsx','.xlsm')) and not rel.startswith('fuentes/'): fail(f'Excel fuera de fuentes/: {rel}')
    old=['battelle_db_transcripcion_v4','battelle_tablas_de_correccion','tablas de corrección','cuaderno anotación','tablas_conversion_battelle','inventario_tablas','informe_extraccion','informe_auditoria','generado_excel']
    if any(x in low for x in old): fail(f'Nombre antiguo conocido: {rel}')
    if p.is_dir() and any(x in low for x in ['auditorias','battelle_parser','generado_excel']): fail(f'Directorio antiguo prohibido: {rel}')
    if p.is_file() and any(x in low for x in ['ocr','tiff','tif','ccitt']) and not rel.startswith('scripts/validar_limpieza_fuentes.py'): fail(f'Archivo OCR/TIFF/CCITT prohibido: {rel}')
for rel in ['data/tablas_conversion_battelle.json']:
    if (ROOT/rel).exists(): fail(f'Dato normativo antiguo presente: {rel}')
text_ext={'.html','.js','.mjs','.cjs','.json','.md','.py','.css'}
for p in ROOT.rglob('*'):
    if '.git' in p.parts or 'node_modules' in p.parts or not p.is_file() or p.suffix.lower() not in text_ext: continue
    rel=p.relative_to(ROOT).as_posix()
    txt=p.read_text(encoding='utf-8', errors='ignore').lower()
    if rel!='scripts/validar_limpieza_fuentes.py' and p.suffix.lower() in {'.html','.js','.mjs','.cjs','.py','.json','.css'}:
        for ref in ['data/tablas_conversion_battelle.json','battelle_tablas de corrección.pdf','battelle_db_transcripcion_v4']:
            if ref in txt: fail(f'Referencia a dato eliminado en {rel}: {ref}')
    if p.suffix.lower()=='.js':
        if re.search(r'percentil\s*[:=]\s*\d+', txt): fail(f'Posible baremo incrustado en JavaScript: {rel}')
required=['data/items_areas_subareas.json','data/modelo_escalas_battelle.json','data/reglas_puntuacion_basal_techo.json','src/battelle-scoring.js','src/battelle-scales.js','src/battelle-state.js','src/battelle-correction.js','fuentes/README.md','fuentes/percentiles/.gitkeep','fuentes/edades_equivalentes/.gitkeep','fuentes/conversiones_generales/.gitkeep','fuentes/screening/.gitkeep']
for rel in required:
    if not (ROOT/rel).exists(): fail(f'Falta requerido: {rel}')
try:
    data=json.loads((ROOT/'data/items_areas_subareas.json').read_text())
    if len(data.get('items',[]))!=341: fail('No hay 341 ítems')
    subs=sum(len(a.get('subareas',[])) for a in data.get('areas',[]))
    if subs!=22: fail(f'No hay 22 subáreas: {subs}')
except Exception as e: fail(f'No se pudo validar ítems/subáreas: {e}')
if errors:
    print('\n'.join(errors)); sys.exit(1)
print('OK: limpieza de fuentes validada; 341 ítems y 22 subáreas conservados.')
