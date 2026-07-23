import json
from .common import DATA

def maximos_teoricos():
 items=json.loads((DATA/'items_areas_subareas.json').read_text(encoding='utf-8'))
 m={}
 for area in items['areas']:
  total=0
  for sub in area['subareas']:
   mx=len(sub['items'])*2; total+=mx
   m[sub['nombre']]=mx; m[f"{area['nombre']}|{sub['nombre']}"]=mx
  m[area['nombre']]=total
 m['Battelle total']=sum(m[a['nombre']] for a in items['areas'])
 return m
