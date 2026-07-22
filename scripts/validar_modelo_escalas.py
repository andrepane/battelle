#!/usr/bin/env python3
import json, sys
from collections import Counter
EXPECTED_MAX = {
 'personal_social_total':170,'adaptativa_total':118,'motora_gruesa':88,'motora_fina':76,'motora_total':164,
 'comunicacion_receptiva':54,'comunicacion_expresiva':64,'comunicacion_total':118,'cognitiva_total':112,'battelle_total':682}
def canon(c): return ''.join(c.split())
def main():
 items=json.load(open('data/items_areas_subareas.json',encoding='utf-8'))['items']; model=json.load(open('data/modelo_escalas_battelle.json',encoding='utf-8'))['escalas']; errs=[]
 areas={i['area'] for i in items}; subareas={f"{i['area']}|{i['subarea']}" for i in items}
 def codes(scale):
  out=[canon(i['codigo']) for i in items if i['area'] in scale.get('areas',[]) or f"{i['area']}|{i['subarea']}" in scale.get('subareas',[])]
  return out
 for sid,scale in model.items():
  for a in scale.get('areas',[]):
   if a not in areas: errs.append(f'{sid}: área inexistente {a}')
  for s in scale.get('subareas',[]):
   if s not in subareas: errs.append(f'{sid}: subárea inexistente {s}')
  cs=codes(scale)
  if len(cs)!=len(set(cs)): errs.append(f'{sid}: doble conteo')
  mx=len(cs)*2
  if sid in EXPECTED_MAX and mx!=EXPECTED_MAX[sid]: errs.append(f'{sid}: máximo {mx} != {EXPECTED_MAX[sid]}')
 covered=set().union(*(set(codes(s)) for s in model.values()))
 allcodes={canon(i['codigo']) for i in items}
 if covered!=allcodes: errs.append(f'cobertura incorrecta: faltan {len(allcodes-covered)}, sobran {len(covered-allcodes)}')
 print('Validación modelo escalas Battelle')
 for sid in EXPECTED_MAX: print(f'  {sid}: {EXPECTED_MAX[sid]}')
 if errs:
  print('ERRORES:'); [print(' - '+e) for e in errs]; return 1
 print('OK: cobertura, máximos, nombres y ausencia de doble conteo.')
 return 0
if __name__=='__main__': sys.exit(main())
