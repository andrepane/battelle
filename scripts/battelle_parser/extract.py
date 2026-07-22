from __future__ import annotations
import json, csv, hashlib, re
from pathlib import Path
from .xlsx_io import read_workbook
from .detect import detect_titles, delimit_blocks, classify
from .normalization import normalize_ocr, parse_pd_token, normalize_spaces
ST_REVIEW='REVISADO_VISUALMENTE'; ST_AUTO='EXTRAIDO_AUTOMATICAMENTE_ALTA_CONFIANZA'; ST_PENDING='PENDIENTE_REVISION_VISUAL'; ST_BLOCK='BLOQUEADO_POR_AMBIGUEDAD'
AREAS=['Personal/Social','Adaptativa','Motora','Comunicación','Cognitiva']

def sheet_headers(cells):
 rows={}
 for c in cells: rows.setdefault(c.row,[]).append(c.value)
 for r in sorted(rows)[:20]:
  vals=[normalize_spaces(v) for v in rows[r]]
  if len(vals)>1: return vals
 return []

def audit_sources(src, db):
 return {'archivos':[{'ruta':src,'hojas':summarize(read_workbook(src))},{'ruta':db,'hojas':summarize(read_workbook(db))}]}
def summarize(wb):
 return [{'nombre':s['name'],'filas':s['max_row'],'columnas':s['max_col'],'encabezados':sheet_headers(s['cells'])} for s in wb['sheets']]

def protected_rows(db_path):
 wb=read_workbook(db_path); rows=[]; canon_rows=[]
 for s in wb['sheets']:
  grid={(c.row,c.col):c.value for c in s['cells']}
  headers={normalize_spaces(v):col for (row,col),v in grid.items() if row==1}
  if 'EstadoRevision' not in headers: continue
  for r in range(2,s['max_row']+1):
   tabla=grid.get((r,headers.get('Tabla',-1)),'')
   estado=grid.get((r,headers['EstadoRevision']),'')
   if re.fullmatch(r'N-(?:[3-9]|1[0-2])',str(tabla)) and normalize_spaces(estado) in [ST_REVIEW,'REVISADO VISUALMENTE']:
    base={h:grid.get((r,c),'') for h,c in headers.items()}
    canon_rows.append(base)
    rec=dict(base)
    rec.setdefault('origen_dato','v4_revisado')
    rec.setdefault('confianza_extraccion','1.0')
    rec.setdefault('hoja_fuente',s['name'])
    rec.setdefault('celda_o_rango_fuente',f"fila {r}")
    rec.setdefault('texto_fuente','registro protegido v4')
    rec.setdefault('reglas_ocr_aplicadas','')
    rec.setdefault('requiere_revision','false')
    rows.append(rec)
 canon=json.dumps(sorted(canon_rows,key=lambda x:json.dumps(x,sort_keys=True,ensure_ascii=False)),sort_keys=True,ensure_ascii=False,separators=(',',':'))
 return rows, hashlib.sha256(canon.encode()).hexdigest()


def dump_csv(path, rows):
 if not rows:
  path.write_text('', encoding='utf-8'); return
 keys=[]
 for r in rows:
  for k in r:
   if k not in keys: keys.append(k)
 with path.open('w', newline='', encoding='utf-8') as f:
  w=csv.DictWriter(f, fieldnames=keys); w.writeheader(); w.writerows(rows)

def extract(src, db, outdir):
 out=Path(outdir); out.mkdir(parents=True,exist_ok=True)
 wb=read_workbook(src); titles=detect_titles(wb); blocks=delimit_blocks(titles, wb)
 prot, checksum=protected_rows(db)
 pd_rows=list(prot); n1=[]; special=[]; incid=[]; inv=[]
 seen=set()
 for b in blocks:
  key=b['Tabla']; typ=classify(b['title'],b['n']); count0=len(pd_rows)
  sh=next(s for s in wb['sheets'] if s['name']==b['sheet'])
  cells=[c for c in sh['cells'] if b['start_row']<=c.row<=b['end_row']]
  raw=' | '.join(c.value for c in cells[:80])
  if key in seen:
   incid.append({'Tabla':key,'tipo':'DUPLICADO_TITULO','HojaFuente':b['sheet'],'CeldaFuente':b['coord'],'TextoFuente':b['title']})
  seen.add(key)
  if typ=='CONVERSION_PC_Z_T_CI_ECN':
   for c in cells: n1.append({'PC':'','z':'','T':'','CI':'','ECN':'','EstadoRevision':ST_PENDING,'procedencia':f"{b['sheet']}!{c.coord}",'confianza':0.2,'TextoFuente':c.value})
  elif typ=='TABLA_ESPECIAL_N2':
   special.append({'Tabla':key,'tipo':typ,'titulo':b['title'],'HojaFuente':b['sheet'],'CeldaFuente':b['coord'],'bloque_bruto':raw,'EstadoRevision':ST_PENDING})
  else:
   # conservative token extraction: only pairs in same row where one token is PD and adjacent integer percentile
   byrow={}
   for c in cells: byrow.setdefault(c.row,[]).append(c)
   for row,cs in byrow.items():
    cs=sorted(cs,key=lambda c:c.col)
    for i,c in enumerate(cs[:-1]):
     pd=parse_pd_token(c.value); pctn=normalize_ocr(cs[i+1].value)['normalized']
     if pd and pd.get('PDMax') not in ('',None) and int(pd['PDMin'])>int(pd['PDMax']):
      incid.append({'Tabla':key,'tipo':'INTERVALO_PD_INVALIDO','HojaFuente':b['sheet'],'CeldaFuente':c.coord,'TextoFuente':c.value})
      continue
     if pd and re.fullmatch(r'\d{1,3}',pctn) and 0<=int(pctn)<=100:
      rec={'Tabla':key,'PaginaPDF':'','EdadMinMeses':'','EdadMaxMeses':'','Area':'','Subarea':'',**pd,'Percentil':int(pctn),'EstadoRevision':ST_PENDING,'ConfianzaExtraccion':0.55,'origen_dato':'excel_ocr','confianza_extraccion':0.55,'HojaFuente':b['sheet'],'hoja_fuente':b['sheet'],'CeldaFuente':c.coord,'celda_o_rango_fuente':c.coord,'TextoFuente':f"{c.value} {cs[i+1].value}",'texto_fuente':f"{c.value} {cs[i+1].value}",'reglas_ocr_aplicadas':'', 'requiere_revision':'true','IncidenciaOCR':''}
      pd_rows.append(rec)
  inv.append({'Tabla':key,'tipo':typ,'titulo_detectado':b['title'],'pagina':'','rango_cronologico':'','area':'','escalas_encontradas':[],'registros_extraidos':len(pd_rows)-count0 if typ=='PD_A_PERCENTIL' else (len(n1) if b['n']==1 else len(special)),'estado':'LOCALIZADA','incidencias':[x for x in incid if x.get('Tabla')==key]})
 expected={f'N-{i}' for i in range(1,53)}; found={x['Tabla'] for x in titles}
 coverage={'esperadas':52,'localizadas':len(found),'faltantes':sorted(expected-found,key=lambda x:int(x.split('-')[1])),'checksum_protegido_antes':checksum,'checksum_protegido_despues':protected_rows(db)[1],'registros_pd':len(pd_rows),'protegidos':len(prot),'incidencias':len(incid)}
 def dump_json(name,obj): (out/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2,sort_keys=True),encoding='utf-8')
 dump_json('inventario_tablas.json',inv); dump_json('pd_percentil.json',pd_rows); dump_json('n1_conversion_pc.json',n1); dump_json('tablas_especiales.json',special); dump_json('incidencias.json',incid); dump_json('cobertura_validacion.json',coverage); dump_json('auditoria_fuentes.json',audit_sources(src,db))
 dump_csv(out/'pd_percentil.csv', pd_rows); dump_csv(out/'n1_conversion_pc.csv', n1); dump_csv(out/'inventario_tablas.csv', inv); dump_csv(out/'incidencias.csv', incid)
 (out/'fixture_sha256_n3_n12_revisado.txt').write_text(checksum+'\n',encoding='utf-8')
 return coverage
