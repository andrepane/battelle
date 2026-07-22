#!/usr/bin/env python3
import json,re,sys
from pathlib import Path
p=Path('data/edades_equivalentes.json')
data=json.loads(p.read_text(encoding='utf-8'))
errs=[]
esc=data.get('escalas',{})
for n in range(54,66):
    if not any(v.get('tabla')==f'N-{n}' for v in esc.values()): errs.append(f'Falta N-{n}')
for name,tab in esc.items():
    regs=tab.get('registros',[])
    if not regs and not tab.get('dudas_visuales'): errs.append(f'{name}: sin registros ni dudas documentadas')
    last=-1; seen={}
    for r in sorted(regs,key=lambda x:(x['puntuacion_min'],x['puntuacion_max'])):
        for f in ['puntuacion_min','puntuacion_max','edad_equivalente_meses','pagina_pdf']:
            if not isinstance(r.get(f),int) or r[f]<0: errs.append(f'{name}: campo inválido {f} en {r}')
        if r['puntuacion_min']>r['puntuacion_max']: errs.append(f'{name}: intervalo invertido {r}')
        if r['puntuacion_min']<=last: errs.append(f'{name}: solape/desorden en {r}')
        last=r['puntuacion_max']
        if not r.get('valor_original_puntuacion') or not r.get('valor_original_edad'): errs.append(f'{name}: no conserva originales {r}')
        for pd in range(r['puntuacion_min'],r['puntuacion_max']+1):
            if pd in seen: errs.append(f'{name}: PD {pd} duplicada')
            seen[pd]=r['edad_equivalente_meses']
# dudas visuales documentadas for N54 and any confianza != alta
for name,tab in esc.items():
    if tab.get('tabla')=='N-54' and not tab.get('dudas_visuales'): errs.append('N-54: dudas visuales no documentadas')
# checks N65
n65=next(v for v in esc.values() if v.get('tabla')=='N-65')
lookup={}
for r in n65['registros']:
    for pd in range(r['puntuacion_min'],r['puntuacion_max']+1): lookup[pd]=r['edad_equivalente_meses']
for pd,ed in {386:37,421:41,436:43,464:47,537:57,562:60}.items():
    if lookup.get(pd)!=ed: errs.append(f'N-65: PD {pd} -> {lookup.get(pd)}, esperado {ed}')
if errs:
    print('\n'.join(errs)); sys.exit(1)
print(f'OK: {len(esc)} escalas validadas; N-54..N-65 presentes; N-65 comprobaciones conocidas correctas.')
