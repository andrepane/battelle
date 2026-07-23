from __future__ import annotations
import re, unicodedata

def clean_text(v): return str(v).strip() if v is not None else ''
def slug(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
 return re.sub(r'[^a-z0-9]+','_',s).strip('_')
def as_int(v):
 s=clean_text(v).replace(',','.')
 if not s: return None
 try: return int(float(s))
 except ValueError: return None
def as_float(v):
 s=clean_text(v).replace(',','.')
 if not s: return None
 try: return float(s)
 except ValueError: return None
def parse_pd(v, max_teorico=None):
 raw=clean_text(v).replace('–','-').replace('—','-')
 m=re.match(r'^(\d+)(?:\.0)?\s*\+$',raw)
 if m:
  mn=int(m.group(1)); return {'pd_texto_original':raw,'pd_min':mn,'pd_max':max_teorico,'limite_superior_abierto':True}
 m=re.match(r'^(\d+)(?:\.0)?\s*-\s*(\d+)(?:\.0)?$',raw)
 if m: return {'pd_texto_original':raw,'pd_min':int(m.group(1)),'pd_max':int(m.group(2)),'limite_superior_abierto':False}
 n=as_int(raw)
 if n is not None: return {'pd_texto_original':raw,'pd_min':n,'pd_max':n,'limite_superior_abierto':False}
 return None
def parse_months(v):
 raw=clean_text(v).replace('–','-').replace('—','-')
 p=parse_pd(raw, None)
 if p: return {'edad_equivalente_texto':raw,'edad_equivalente_min_meses':p['pd_min'],'edad_equivalente_max_meses':p['pd_max'],'edad_equivalente_limite_superior_abierto':p['limite_superior_abierto']}
 return {'edad_equivalente_texto':raw,'edad_equivalente_min_meses':None,'edad_equivalente_max_meses':None,'edad_equivalente_limite_superior_abierto':False}
