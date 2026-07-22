from __future__ import annotations
import json, csv, hashlib, re
from pathlib import Path
from .xlsx_io import read_workbook
from .detect import detect_titles, delimit_blocks, classify, detect_area
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

def canonical_key_record(r):
 return '|'.join(str(x) for x in [r.get('Tabla') or r.get('tabla'), r.get('EdadMinMeses') or r.get('edad_cronologica_min_meses'), r.get('EdadMaxMeses') or r.get('edad_cronologica_max_meses'), canonical_scale(r.get('Subarea') or r.get('escala') or ''), r.get('PDMin') if 'PDMin' in r else r.get('puntuacion_directa_min'), r.get('PDMax') if 'PDMax' in r else r.get('puntuacion_directa_max'), r.get('LimiteSuperiorAbierto') or ('1' if str(r.get('valor_original_pd','')).endswith('+') else '0')])

def canonical_scale(name):
 aliases={'Personal-Social':'personal_social','Personal/Social':'personal_social'}
 return aliases.get(str(name), str(name).strip().lower().replace(' ','_'))

def flatten_active(active_path='data/percentiles_battelle.json'):
 p=Path(active_path)
 if not p.exists(): return []
 data=json.loads(p.read_text(encoding='utf-8'))
 return [r for tramo in data.get('tramos',[]) for r in tramo.get('registros',[])]

def split_sets(pd_rows):
 protected=[]; cotejados=[]; pending=[]; rejected=[]; ids=set(); dup=[]
 active=flatten_active(); active_by_key={}
 for i,a in enumerate(active): active_by_key.setdefault(canonical_key_record(a),[]).append((i,a))
 for i,r in enumerate(pd_rows):
  rid=canonical_key_record(r)+'|'+str(r.get('Percentil'))+'|'+str(i)
  if rid in ids: dup.append(rid)
  ids.add(rid)
  if r.get('origen_dato')=='v4_revisado':
   protected.append(r); continue
  matches=active_by_key.get(canonical_key_record(r),[])
  exact=[(j,a) for j,a in matches if str(a.get('percentil'))==str(r.get('Percentil'))]
  if len(exact)==1 and r.get('Tabla') not in [f'N-{n}' for n in range(3,13)]:
   nr=dict(r); nr['EstadoRevision']='COTEJADO_CON_DATO_ACTIVO'; nr['referencia_dato_activo']=exact[0][0]; nr['aclaracion']='cotejo exacto con dato activo; no es revisión visual independiente'; nr['requiere_revision']='false'; cotejados.append(nr)
  else:
   pending.append(r)
 return protected,cotejados,pending,rejected,dup

def compare_active(pd_rows, active_path='data/percentiles_battelle.json'):
 active=flatten_active(active_path)
 active_by_key={}
 for i,a in enumerate(active): active_by_key.setdefault(canonical_key_record(a),[]).append((i,a))
 ocr=[r for r in pd_rows if r.get('origen_dato')=='excel_ocr']
 ocr_by_key={}
 for i,r in enumerate(ocr): ocr_by_key.setdefault(canonical_key_record(r),[]).append((i,r))
 counts={'registros_activos_totales':len(active),'coincidencias_exactas':0,'registros_activos_sin_candidato_ocr':0,'candidatos_ocr_sin_equivalente_activo':0,'diferencias_percentil':0,'diferencias_pdmin_pdmax':0,'diferencias_escala':0,'diferencias_tramo_cronologico':0,'diferencias_tabla':0,'diferencias_pagina':0,'coincidencias_multiples_ambiguas':0}
 by={}
 for key,alist in active_by_key.items():
  candidates=ocr_by_key.get(key,[])
  tab=alist[0][1].get('tabla','')
  b=by.setdefault(tab,dict(counts,registros_activos_totales=0))
  b['registros_activos_totales']+=len(alist)
  if not candidates:
   counts['registros_activos_sin_candidato_ocr']+=len(alist); b['registros_activos_sin_candidato_ocr']+=len(alist); continue
  if len(candidates)>1:
   counts['coincidencias_multiples_ambiguas']+=1; b['coincidencias_multiples_ambiguas']+=1; continue
  for _,a in alist:
   if str(a.get('percentil'))==str(candidates[0][1].get('Percentil')):
    counts['coincidencias_exactas']+=1; b['coincidencias_exactas']+=1
   else:
    counts['diferencias_percentil']+=1; b['diferencias_percentil']+=1
 for key,cands in ocr_by_key.items():
  if key not in active_by_key: counts['candidatos_ocr_sin_equivalente_activo']+=len(cands)
 return {'clave_canonica':['tabla','EdadMinMeses','EdadMaxMeses','escala_canonica','PDMin','PDMax','LimiteSuperiorAbierto'],'aliases_escala':{'Personal-Social':'personal_social','Personal/Social':'personal_social'},'totales':counts,'por_tabla':by,'por_tramo_edad':{},'por_area':{},'por_escala':{}}

def extract(src, db, outdir):
 out=Path(outdir); out.mkdir(parents=True,exist_ok=True)
 wb=read_workbook(src); titles=detect_titles(wb); blocks=delimit_blocks(titles, wb)
 prot, checksum=protected_rows(db)
 pd_rows=list(prot); n1=[]; special=[]; incid=[]; inv=[]; rejected=[]
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
      rec={'Tabla':key,'PaginaPDF':'','EdadMinMeses':'','EdadMaxMeses':'','Area':detect_area(b['title']),'Subarea':'',**pd,'Percentil':int(pctn),'EstadoRevision':ST_PENDING,'ConfianzaExtraccion':0.55,'origen_dato':'excel_ocr','confianza_extraccion':0.55,'HojaFuente':b['sheet'],'hoja_fuente':b['sheet'],'CeldaFuente':c.coord,'celda_o_rango_fuente':c.coord,'TextoFuente':f"{c.value} {cs[i+1].value}",'texto_fuente':f"{c.value} {cs[i+1].value}",'reglas_ocr_aplicadas':'', 'requiere_revision':'true','IncidenciaOCR':''}
      pd_rows.append(rec)
  norm=len(pd_rows)-count0 if typ=='PD_A_PERCENTIL' else 0
  inv.append({'tabla':key,'Tabla':key,'tipo':typ,'titulo_detectado':b['title'],'hoja':b['sheet'],'fila_inicial':b['start_row'],'fila_final':b['end_row'],'pagina':'','rango_edad':'','area':detect_area(b['title']),'escalas_detectadas':[],'registros_brutos':len(cells),'registros_normalizados':norm,'registros_protegidos':sum(1 for r in prot if r.get('Tabla')==key),'registros_automaticos':norm,'registros_utilizables':0,'registros_pendientes':norm,'registros_rechazados':0,'incidencias':len([x for x in incid if x.get('Tabla')==key]),'estado_final':'PENDIENTE_REVISION_VISUAL','evidencia':{'celda':b['coord'],'texto_fuente':b.get('title_source',b['title'])}})
 expected={f'N-{i}' for i in range(1,53)}; found={x['Tabla'] for x in titles}
 for tab in sorted(expected-found,key=lambda x:int(x.split('-')[1])):
  n=int(tab.split('-')[1])
  inv.append({'tabla':tab,'Tabla':tab,'tipo':classify('',n),'titulo_detectado':'','hoja':'Table 1','fila_inicial':'','fila_final':'','pagina':'','rango_edad':'','area':'','escalas_detectadas':[],'registros_brutos':0,'registros_normalizados':0,'registros_protegidos':sum(1 for r in prot if r.get('Tabla')==tab),'registros_automaticos':0,'registros_utilizables':0,'registros_pendientes':sum(1 for r in prot if r.get('Tabla')==tab),'registros_rechazados':0,'incidencias':1,'estado_final':'NO_LOCALIZADA','evidencia':{'intervalo_inspeccionado':'hoja completa; reglas generales de títulos N-x','titulo_anterior':'','titulo_posterior':''}})
 inv=sorted(inv,key=lambda r:int(r['Tabla'].split('-')[1]))
 protected_set,cotejados_set,pending_set,rejected_set,dup_ids=split_sets(pd_rows)
 bloques_solapados=sum(1 for a,b in zip(blocks,blocks[1:]) if a['sheet']==b['sheet'] and a['end_row']>=b['start_row'])
 extra_2005={'total_incremento_vs_version_4555':len(pd_rows)-4555,'por_tablas_inicialmente_ausentes':{t:sum(r['registros_normalizados'] for r in inv if r['Tabla']==t) for t in ['N-4','N-9','N-10','N-12','N-17','N-19','N-22','N-32','N-42','N-47']},'bloques_solapados_detectados':bloques_solapados,'celdas_asignadas_multiple':'diagnóstico pendiente; registros OCR no utilizables'}
 coverage={'esperadas':52,'localizadas':len(found),'faltantes':sorted(expected-found,key=lambda x:int(x.split('-')[1])),'checksum_protegido_antes':checksum,'checksum_protegido_despues':protected_rows(db)[1],'registros_pd':len(pd_rows),'protegidos':len(prot),'incidencias':len(incid),'utilizables_protegidos_v4':len(protected_set),'utilizables_cotejados_con_datos_activos':len(cotejados_set),'automaticos_pendientes_revision':len(pending_set),'rechazados':len(rejected_set),'duplicados_identificador':len(dup_ids),'aumento_4555_a_actual':extra_2005}
 def dump_json(name,obj): (out/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2,sort_keys=True),encoding='utf-8')
 dump_json('informe_tablas.json',inv); dump_json('inventario_tablas.json',inv); dump_json('pd_percentil.json',pd_rows); dump_json('n1_conversion_pc.json',n1); dump_json('tablas_especiales.json',special); dump_json('utilizables_protegidos_v4.json',protected_set); dump_json('utilizables_cotejados_con_datos_activos.json',cotejados_set); dump_json('registros_utilizables.json',protected_set+cotejados_set); dump_json('registros_pendientes_revision.json',pending_set); dump_json('registros_rechazados.json',rejected_set); dump_json('comparacion_percentiles_existentes.json',compare_active(pd_rows)); dump_json('n1_comparacion_v4.json',{'estado':'PENDIENTE_REVISION_VISUAL','coincidencias':0,'diferencias':0,'filas_pendientes':len(n1)}); dump_json('n2_documentacion.json',{'estado':'PENDIENTE_REVISION_VISUAL','registros':len(special),'finalidad':'tabla especial independiente; no integrada en PD percentil'}); dump_json('incidencias.json',incid); dump_json('cobertura_validacion.json',coverage); dump_json('auditoria_fuentes.json',audit_sources(src,db))
 dump_csv(out/'pd_percentil.csv', pd_rows); dump_csv(out/'n1_conversion_pc.csv', n1); dump_csv(out/'inventario_tablas.csv', inv); dump_csv(out/'incidencias.csv', incid)
 (out/'fixture_sha256_n3_n12_revisado.txt').write_text(checksum+'\n',encoding='utf-8')
 return coverage
