#!/usr/bin/env python3
import json, datetime, sys
from pathlib import Path
from battelle_excel.common import DATA, VERSION
from battelle_excel.extract import percentiles, conversiones, edades

def dump(name,obj):
 p=DATA/name; p.write_text(json.dumps(obj,ensure_ascii=False,indent=2,sort_keys=True)+'\n',encoding='utf-8')
 return p

def main():
 DATA.mkdir(exist_ok=True)
 pct=percentiles(); conv=conversiones(); ed=edades()
 inc={'version_esquema':VERSION,'fecha_generacion':datetime.date.today().isoformat(),'incidencias':[]}
 meta={'version_esquema':VERSION,'fecha_generacion':datetime.date.today().isoformat(),'estado':'generado_para_validacion','archivos_generados':['data/percentiles_battelle.json','data/conversion_total_battelle.json','data/conversion_pc_general.json','data/edades_equivalentes.json'],'resumen':{'percentiles':len(pct['registros']),'conversion_total':len(conv['total']['registros']),'conversion_pc_general':len(conv['pc']['registros']),'edades_equivalentes':len(ed['registros'])}}
 for n,o in [('percentiles_battelle.json',pct),('conversion_total_battelle.json',conv['total']),('conversion_pc_general.json',conv['pc']),('edades_equivalentes.json',ed),('baremos_metadata.json',meta),('baremos_incidencias.json',inc)]: dump(n,o)
 print(json.dumps(meta['resumen'],ensure_ascii=False,sort_keys=True))
if __name__=='__main__': main()
