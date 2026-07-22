#!/usr/bin/env python3
import json, sys
EXPECTED_MAX = {
 'personal_social_total':170,'adaptativa_total':118,'motora_gruesa':88,'motora_fina':76,'motora_total':164,
 'comunicacion_receptiva':54,'comunicacion_expresiva':64,'comunicacion_total':118,'cognitiva_total':112,'battelle_total':682}
def canon(c): return ''.join(c.split())
def subkey(area, subarea): return f'{area}|{subarea}'
def main():
 items=json.load(open('data/items_areas_subareas.json',encoding='utf-8'))['items']
 full_model=json.load(open('data/modelo_escalas_battelle.json',encoding='utf-8'))
 model=full_model['escalas']; declared_subareas=full_model.get('subareas',{})
 errs=[]; areas={i['area'] for i in items}; subareas={subkey(i['area'],i['subarea']) for i in items}
 item_by_code={canon(i['codigo']): i for i in items}
 declared_keys=[]
 for sid, sub in declared_subareas.items():
  key=subkey(sub.get('area'), sub.get('subarea'))
  declared_keys.append(key)
  if sub.get('area') not in areas: errs.append(f'{sid}: área inventada {sub.get("area")}')
  if key not in subareas: errs.append(f'{sid}: subárea inventada {key}')
  codes=[canon(i['codigo']) for i in items if i['area']==sub.get('area') and i['subarea']==sub.get('subarea')]
  if not codes: errs.append(f'{sid}: subárea sin ítems')
  for c in codes:
   it=item_by_code[c]
   if it['area']!=sub.get('area') or it['subarea']!=sub.get('subarea'): errs.append(f'{sid}: contiene ítem ajeno {c}')
 for key in subareas:
  if declared_keys.count(key)!=1: errs.append(f'subárea documental no declarada exactamente una vez: {key} ({declared_keys.count(key)})')
 for key in declared_keys:
  if key not in subareas: errs.append(f'subárea declarada no documental: {key}')
 def codes(scale):
  out=[canon(i['codigo']) for i in items if i['area'] in scale.get('areas',[]) or subkey(i['area'],i['subarea']) in scale.get('subareas',[])]
  for sub_id in scale.get('subarea_ids',[]):
   sub=declared_subareas.get(sub_id)
   if sub: out.extend(canon(i['codigo']) for i in items if i['area']==sub['area'] and i['subarea']==sub['subarea'])
  return out
 subarea_union=[]
 for sub in declared_subareas.values():
  subarea_union.extend(canon(i['codigo']) for i in items if i['area']==sub.get('area') and i['subarea']==sub.get('subarea'))
 if len(subarea_union)!=341 or len(set(subarea_union))!=341: errs.append(f'unión de subáreas inválida: {len(subarea_union)} entradas, {len(set(subarea_union))} únicas')
 if set(subarea_union)!={canon(i['codigo']) for i in items}: errs.append('la unión de subáreas no cubre exactamente los 341 ítems')
 for sid,scale in model.items():
  for a in scale.get('areas',[]):
   if a not in areas: errs.append(f'{sid}: área inexistente {a}')
  for s in scale.get('subareas',[]):
   if s not in subareas: errs.append(f'{sid}: subárea inexistente {s}')
  for sub_id in scale.get('subarea_ids',[]):
   if sub_id not in declared_subareas: errs.append(f'{sid}: subarea_id inexistente {sub_id}')
  cs=codes(scale)
  if len(cs)!=len(set(cs)): errs.append(f'{sid}: doble conteo')
  mx=len(cs)*2
  if sid in EXPECTED_MAX and mx!=EXPECTED_MAX[sid]: errs.append(f'{sid}: máximo {mx} != {EXPECTED_MAX[sid]}')
 print('Validación modelo escalas Battelle')
 print(f'Subáreas documentales declaradas: {len(declared_subareas)}')
 for sid in EXPECTED_MAX: print(f'  {sid}: {EXPECTED_MAX[sid]}')
 if errs:
  print('ERRORES:'); [print(' - '+e) for e in errs]; return 1
 print('OK: subáreas declaradas, cobertura, máximos, nombres y ausencia de doble conteo.')
 return 0
if __name__=='__main__': sys.exit(main())
