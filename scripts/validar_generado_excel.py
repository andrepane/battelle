#!/usr/bin/env python3
import json, sys
from pathlib import Path
p=Path('data/generado_excel')
inv=json.loads((p/'inventario_tablas.json').read_text())
pd=json.loads((p/'pd_percentil.json').read_text())
cov=json.loads((p/'cobertura_validacion.json').read_text())
errs=[]
if len({r['Tabla'] for r in inv})!=cov['localizadas']: errs.append('inventario duplicado')
if any(r['Tabla']=='N-1' for r in pd): errs.append('N-1 mezclada en PD')
if cov['checksum_protegido_antes']!=cov['checksum_protegido_despues']: errs.append('checksum protegido cambia')
for r in pd:
 if r.get('EstadoRevision')=='REVISADO_VISUALMENTE' and not (r.get('Tabla') in [f'N-{i}' for i in range(3,13)]): errs.append('fila nueva revisada')
 if r.get('Percentil')!='' and not (0<=int(r['Percentil'])<=100): errs.append('percentil invalido')
 if r.get('PDMax') not in ('',None) and int(r['PDMin'])>int(r['PDMax']): errs.append('intervalo invalido')
print('OK' if not errs else '\n'.join(errs))
sys.exit(1 if errs else 0)
