#!/usr/bin/env python3
import json, sys
from collections import Counter, defaultdict
from battelle_excel.common import DATA,TRAMOS
from battelle_excel.extract import percentiles, conversiones, edades

def load(n): return json.loads((DATA/n).read_text(encoding='utf-8'))
def canon(o):
 x=json.loads(json.dumps(o)); x.pop('fecha_generacion',None); return json.dumps(x,sort_keys=True,ensure_ascii=False)
def model_ids():
 m=json.loads((DATA/'modelo_escalas_battelle.json').read_text(encoding='utf-8'))
 return set(m['escalas']) | set(m['subareas'])
def fail(msgs):
 print('\n'.join('ERROR: '+m for m in msgs)); sys.exit(1)
def main():
 errs=[]; ids=model_ids(); pct=load('percentiles_battelle.json'); pc=load('conversion_pc_general.json'); total=load('conversion_total_battelle.json'); ed=load('edades_equivalentes.json')
 if len(pct['tablas_incluidas'])!=50 or sorted(pct['tablas_incluidas'], key=lambda x:int(x.split('-')[1]))!=[f'N-{i}' for i in range(3,53)]: errs.append('Percentiles no contienen exactamente N-3..N-52')
 bytr={t:0 for t in TRAMOS}
 for t in pct['tablas_incluidas']:
  for tr in {r['tramo_cronologico'] for r in pct['registros'] if r['tabla']==t}: bytr[tr]+=1
 if any(v!=5 for v in bytr.values()): errs.append(f'No hay cinco tablas por tramo: {bytr}')
 keys=set(); totals=defaultdict(set)
 for r in pct['registros']:
  sid=r.get('escala_id')
  if not sid: errs.append(f'falta escala_id {r.get("tabla")} fila {r.get("fuente",{}).get("fila")}')
  elif sid not in ids: errs.append(f'escala_id no reconocida {sid}')
  if sid=='battelle_total' or r['escala']=='Battelle total': errs.append('Battelle total aparece en percentiles')
  if r['escala']=='Puntuación total': totals[r['tabla']].add(sid)
  k=(r['tabla'],r['tramo_cronologico'],sid,r['pd_min'],r['pd_max'])
  if k in keys: errs.append(f'duplicado percentil {k}')
  keys.add(k)
  if r['pd_min']<0 or not(1<=r['percentil']<=99): errs.append(f'valor inválido {k}')
 expected_totals={'personal_social_total','adaptativa_total','motora_total','comunicacion_total','cognitiva_total'}
 found_totals={r['escala_id'] for r in pct['registros'] if r['escala']=='Puntuación total'}
 if not expected_totals.issubset(found_totals): errs.append(f'totales de área no inequívocos: {found_totals}')
 pcs=sorted(r['pc'] for r in pc['registros'])
 if pcs!=list(range(1,100)): errs.append('N-1 no cubre PC 1..99')
 r50=next((r for r in pc['registros'] if r['pc']==50),{})
 if not (r50.get('z')==0 and r50.get('T')==50 and r50.get('CI')==100 and r50.get('ECN')==50): errs.append('N-1 PC 50 incorrecto')
 if {r.get('escala_id') for r in total['registros']}!={'battelle_total'}: errs.append('N-2 no es exclusivamente Battelle total')
 if set(ed['tablas_incluidas'])!=set(f'N-{i}' for i in range(56,66)): errs.append('Edades equivalentes no contienen N-56..N-65')
 if len(ed['registros'])!=732: errs.append(f'edades equivalentes debe tener 732 registros normativos, tiene {len(ed["registros"])}')
 exc=ed.get('excepciones_dominio',[])
 if len(exc)!=1 or exc[0].get('tabla')!='N-56' or exc[0].get('escala_id')!='personal_social_total' or exc[0].get('pd')!=51 or exc[0].get('estado')!='pd_no_alcanzable_confirmada': errs.append('Excepción de dominio N-56 PD 51 inválida')
 if any(r.get('tabla')=='N-56' and r.get('escala_id')=='personal_social_total' and r.get('pd_min') is not None and r['pd_min']<=51<=r.get('pd_max',-1) for r in ed['registros']): errs.append('Existe conversión inventada para N-56 PD 51')
 for pd,mes in [(386,37),(421,41),(436,43),(464,47),(537,57),(562,60)]:
  hit=[r for r in ed['registros'] if r.get('tabla')=='N-65' and r.get('pd_min')<=pd<=r.get('pd_max',-1)]
  if not hit or hit[0].get('edad_equivalente_min_meses')!=mes: errs.append(f'N-65 PD {pd} no da {mes}')
 for obj,name,regen in [(pct,'percentiles',percentiles()),(pc,'pc',conversiones()['pc']),(total,'total',conversiones()['total']),(ed,'edades',edades())]:
  if canon(obj)!=canon(regen): errs.append(f'JSON {name} no coincide con relectura Excel')
 if errs: fail(errs)
 print('Validación Battelle OK')
 print('Percentiles por escala_id:', dict(sorted(Counter(r['escala_id'] for r in pct['registros']).items())))
if __name__=='__main__': main()
