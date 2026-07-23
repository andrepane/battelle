from pathlib import Path
import re, json, datetime
from .xlsx_reader import read_workbook, sha256_file
from .normalization import as_int, as_float
from .common import ROOT,FUENTES,TRAMOS,VERSION
from .model import maximos_teoricos


AREA_TOTAL_IDS={
 'Personal-Social':'personal_social_total',
 'Personal/Social':'personal_social_total',
 'Adaptativa':'adaptativa_total',
 'Motora':'motora_total',
 'Comunicación':'comunicacion_total',
 'Comunicacion':'comunicacion_total',
 'Cognitiva':'cognitiva_total',
}
SPECIAL_SCALE_IDS={
 ('Motora','Motora gruesa'):'motora_gruesa',
 ('Motora','Motora fina'):'motora_fina',
 ('Comunicación','Receptiva'):'comunicacion_receptiva',
 ('Comunicación','Expresiva'):'comunicacion_expresiva',
}
def escala_id(area, escala):
 if escala=='Puntuación total': return AREA_TOTAL_IDS.get(area)
 if not area and escala in AREA_TOTAL_IDS: return AREA_TOTAL_IDS[escala]
 if not area and escala=='Battelle total': return 'battelle_total'
 if (area,escala) in SPECIAL_SCALE_IDS: return SPECIAL_SCALE_IDS[(area,escala)]
 from .normalization import slug
 return f"{slug(area)}_{slug(escala)}"

def rowmap(rows):
 hdr={c:v for c,v in rows[0]['values'].items()}
 return hdr, rows[1:]
def val(r,h,name):
 for c,n in h.items():
  if n==name: return r['values'].get(c,'')
 return ''
def val_col(h,*names):
 for c,n in h.items():
  if n in names: return c
 return None
def col_name(c):
 s=''
 while c:
  c,rem=divmod(c-1,26); s=chr(65+rem)+s
 return s
def source(path, sheet, row, columna=None, celda=None):
 data={'archivo':str(Path(path).relative_to(ROOT)),'sha256':sha256_file(path),'hoja':sheet,'fila':row}
 if columna is not None: data['columna']=columna
 if celda is not None: data['celda']=celda
 return data
def with_meta(regs, fuentes, tablas): return {'version_esquema':VERSION,'fecha_generacion':datetime.date.today().isoformat(),'fuentes':fuentes,'tablas_incluidas':tablas,'registros':regs}

def percentiles():
 maxs=maximos_teoricos(); regs=[]; fuentes=[]
 for tramo in TRAMOS:
  for p in sorted((FUENTES/'percentiles'/tramo).glob('*.xlsx')):
   fuentes.append({'archivo':str(p.relative_to(ROOT)),'sha256':sha256_file(p)})
   sh=[s for s in read_workbook(p) if s['name']=='datos'][0]; h,rs=rowmap(sh['rows'])
   for r in rs:
    escala=str(val(r,h,'escala')); pdmax=as_int(val(r,h,'pd_max') or val(r,h,'pd_total_max'))
    if str(val(r,h,'limite_superior_abierto'))=='1': pdmax=maxs.get(escala, maxs.get(str(val(r,h,'area'))))
    regs.append({'tabla':val(r,h,'tabla'),'tramo_cronologico':tramo,'escala_id':escala_id(str(val(r,h,'area')), escala),'edad_min_meses':as_int(val(r,h,'edad_min_meses')),'edad_max_meses':as_int(val(r,h,'edad_max_meses')),'area':val(r,h,'area'),'escala':escala,'pd_texto_original':val(r,h,'pd_original') or val(r,h,'pd_total_original'),'pd_min':as_int(val(r,h,'pd_min') or val(r,h,'pd_total_min')),'pd_max':pdmax,'limite_superior_abierto':str(val(r,h,'limite_superior_abierto'))=='1','percentil':as_int(val(r,h,'percentil')),'fuente':source(p,sh['name'],r['row'])})
 return with_meta(regs, fuentes, sorted(set(r['tabla'] for r in regs)))

def conversiones():
 out={}
 # N-1
 p=FUENTES/'conversiones_generales/N-1_conversion_PC_z_T_CI_ECN.xlsx'; sh=read_workbook(p)[0]; h,rs=rowmap(sh['rows']); regs=[]
 for r in rs: regs.append({'tabla':'N-1','pc':as_int(val(r,h,'PC')),'z':as_float(val(r,h,'z')),'T':as_float(val(r,h,'T')),'CI':as_float(val(r,h,'CI')),'ECN':as_float(val(r,h,'ECN')),'fuente':source(p,sh['name'],r['row'])})
 out['pc']=with_meta(regs,[{'archivo':str(p.relative_to(ROOT)),'sha256':sha256_file(p)}],['N-1'])
 # N-2
 p=FUENTES/'conversiones_generales/N-2_Battelle_total_centiles_todas_edades.xlsx'; regs=[]; fuentes=[{'archivo':str(p.relative_to(ROOT)),'sha256':sha256_file(p)}]
 for sh in read_workbook(p):
  if sh['name']=='metadatos': continue
  h,rs=rowmap(sh['rows'])
  for r in rs:
   tramo=val(r,h,'tramo_edad') or val(r,h,'rango_edad')
   m=re.match(r'^(\d+)\s*-\s*(\d+)$', str(tramo))
   if not m: raise ValueError(f'N-2 sin tramo cronológico explícito en fila {r["row"]}: {tramo!r}')
   c=val_col(h,'tramo_edad','rango_edad')
   regs.append({'tabla':'N-2','escala_id':'battelle_total','escala':'Battelle total','tramo_cronologico':f'{int(m.group(1)):02d}-{int(m.group(2)):02d}','edad_min_meses':int(m.group(1)),'edad_max_meses':int(m.group(2)),'pd_texto_original':val(r,h,'pd_original') or val(r,h,'pd_total_original'),'pd_min':as_int(val(r,h,'pd_min') or val(r,h,'pd_total_min')),'pd_max':as_int(val(r,h,'pd_max') or val(r,h,'pd_total_max')),'limite_superior_abierto':str(val(r,h,'pd_limite_superior_abierto') or val(r,h,'limite_superior_abierto'))=='1','centil':as_int(val(r,h,'centil')),'fuente':source(p,sh['name'],r['row'],col_name(c),f'{col_name(c)}{r["row"]}')})
 out['total']=with_meta(regs,fuentes,['N-2'])
 return out

def edades():
 regs=[]; fuentes=[]
 for p in sorted((FUENTES/'edades_equivalentes').glob('*.xlsx'))+ [FUENTES/'conversiones_generales/N-65_Battelle_total_edad_equivalente.xlsx']:
  fuentes.append({'archivo':str(p.relative_to(ROOT)),'sha256':sha256_file(p)})
  for sh in read_workbook(p):
   if sh['name']=='metadatos': continue
   h,rs=rowmap(sh['rows'])
   for r in rs:
    escala_nombre=val(r,h,'area') or val(r,h,'ambito') or 'Battelle total'
    regs.append({'tabla':val(r,h,'tabla') or sh['name'],'escala_id':escala_id('', escala_nombre) if escala_nombre!='Battelle total' else 'battelle_total','escala':escala_nombre,'pd_texto_original':val(r,h,'pd_original') or val(r,h,'pd_total_original'),'pd_min':as_int(val(r,h,'pd_min') or val(r,h,'pd_total_min')),'pd_max':as_int(val(r,h,'pd_max') or val(r,h,'pd_total_max')),'limite_superior_abierto':str(val(r,h,'pd_limite_superior_abierto'))=='1','edad_equivalente_texto':val(r,h,'edad_equivalente_original'),'edad_equivalente_min_meses':as_int(val(r,h,'edad_equivalente_min_meses')),'edad_equivalente_max_meses':as_int(val(r,h,'edad_equivalente_max_meses')),'edad_limite_superior_abierto':str(val(r,h,'edad_limite_superior_abierto'))=='1','fuente':source(p,sh['name'],r['row'])})
 excepciones=[{'tabla':'N-56','escala_id':'personal_social_total','escala':'Personal-Social','pd':51,'estado':'pd_no_alcanzable_confirmada','motivo':'La fuente oficial pasa de PD 48-50 a PD 52-53; PD 51 no es alcanzable según la composición real de la escala.','fuente':{'archivo':'fuentes/edades_equivalentes/N-56_Edad_equivalente_Personal-Social.xlsx','sha256':sha256_file(FUENTES/'edades_equivalentes/N-56_Edad_equivalente_Personal-Social.xlsx'),'hoja':'N-56','filas_vecinas':[21,22]}}]
 obj=with_meta(regs,fuentes,sorted(set(r['tabla'] for r in regs)))
 obj['excepciones_dominio']=excepciones
 return obj
