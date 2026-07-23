#!/usr/bin/env python3
import json, sys, hashlib, tempfile, subprocess
from pathlib import Path
from battelle_excel.common import DATA,TRAMOS
from battelle_excel.extract import percentiles, conversiones, edades

def load(n): return json.load(open(DATA/n,encoding='utf-8'))
def canon(o):
 x=json.loads(json.dumps(o)); x.pop('fecha_generacion',None); return json.dumps(x,sort_keys=True,ensure_ascii=False)
def fail(msgs):
 print('\n'.join('ERROR: '+m for m in msgs)); sys.exit(1)
def main():
 errs=[]; pct=load('percentiles_battelle.json'); pc=load('conversion_pc_general.json'); total=load('conversion_total_battelle.json'); ed=load('edades_equivalentes.json')
 if len(pct['tablas_incluidas'])!=50 or sorted(pct['tablas_incluidas'], key=lambda x:int(x.split('-')[1]))!=[f'N-{i}' for i in range(3,53)]: errs.append('Percentiles no contienen exactamente N-3..N-52')
 bytr={t:0 for t in TRAMOS}
 for t in pct['tablas_incluidas']:
  trs={r['tramo_cronologico'] for r in pct['registros'] if r['tabla']==t};
  for tr in trs: bytr[tr]+=1
 if any(v!=5 for v in bytr.values()): errs.append(f'No hay cinco tablas por tramo: {bytr}')
 keys=set()
 for r in pct['registros']:
  if r['escala']=='Battelle total': errs.append('Battelle total aparece en percentiles')
  k=(r['tabla'],r['tramo_cronologico'],r['escala'],r['pd_min'],r['pd_max']);
  if k in keys: errs.append(f'duplicado percentil {k}')
  keys.add(k)
  if r['pd_min']<0 or not(1<=r['percentil']<=99): errs.append(f'valor inválido {k}')
 pcs=sorted(r['pc'] for r in pc['registros'])
 if pcs!=list(range(1,100)): errs.append('N-1 no cubre PC 1..99')
 r50=next((r for r in pc['registros'] if r['pc']==50),{})
 if not (r50.get('z')==0 and r50.get('T')==50 and r50.get('CI')==100 and r50.get('ECN')==50): errs.append('N-1 PC 50 incorrecto')
 if set(ed['tablas_incluidas'])!=set(f'N-{i}' for i in range(56,66)): errs.append('Edades equivalentes no contienen N-56..N-65')
 for pd,mes in [(386,37),(421,41),(436,43),(464,47),(537,57),(562,60)]:
  hit=[r for r in ed['registros'] if r.get('tabla')=='N-65' and r.get('pd_min')<=pd<=r.get('pd_max',-1)]
  if not hit or hit[0].get('edad_equivalente_min_meses')!=mes: errs.append(f'N-65 PD {pd} no da {mes}')
 exc=[r for r in ed['registros'] if r.get('tabla')=='N-56' and r.get('escala')=='Personal-Social' and r.get('pd')==51 and r.get('estado')=='pd_no_alcanzable_confirmada']
 if len(exc)!=1: errs.append('Excepción N-56 PD 51 ausente')
 inv=[r for r in ed['registros'] if r.get('tabla')=='N-56' and r.get('escala')=='Personal-Social' and r.get('pd_min') is not None and r['pd_min']<=51<=r.get('pd_max',-1)]
 if inv: errs.append('Existe conversión inventada para N-56 PD 51')
 for obj,name,regen in [(pct,'percentiles',percentiles()),(pc,'pc',conversiones()['pc']),(total,'total',conversiones()['total']),(ed,'edades',edades())]:
  if canon(obj)!=canon(regen): errs.append(f'JSON {name} no coincide con relectura Excel')
 if errs: fail(errs)
 print('Validación Battelle OK')
if __name__=='__main__': main()
