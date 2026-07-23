#!/usr/bin/env python3
"""Valida estructuralmente las fuentes Excel normativas Battelle sin modificarlas."""
from __future__ import annotations
import hashlib, json, re, sys, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
NS={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
ROOT=Path(__file__).resolve().parents[1]
TRAMOS={range(3,8):'00-05',range(8,13):'06-11',range(13,18):'12-17',range(18,23):'18-23',range(23,28):'24-35',range(28,33):'36-47',range(33,38):'48-59',range(38,43):'60-71',range(43,48):'72-83',range(48,53):'84-95'}
AREAS=['Personal-Social','Adaptativa','Motora','Comunicación','Cognitiva']

def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def norm_target(t):
    t=t.lstrip('/')
    return t if t.startswith('xl/') else 'xl/'+t

def read_xlsx(path:Path):
    with zipfile.ZipFile(path) as z:
        ss=[]
        try:
            root=ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in root.findall('a:si',NS): ss.append(''.join(t.text or '' for t in si.findall('.//a:t',NS)))
        except KeyError: pass
        wb=ET.fromstring(z.read('xl/workbook.xml')); rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        relmap={r.attrib['Id']:r.attrib['Target'] for r in rels}
        out={}
        for s in wb.findall('.//a:sheet',NS):
            name=s.attrib['name']; rid=s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            sh=ET.fromstring(z.read(norm_target(relmap[rid]))); rows=[]
            for row in sh.findall('.//a:sheetData/a:row',NS):
                vals=[]
                last=0
                for c in row.findall('a:c',NS):
                    m=re.match(r'([A-Z]+)',c.attrib.get('r','A'))
                    col=0
                    for ch in (m.group(1) if m else 'A'): col=col*26+ord(ch)-64
                    while last < col-1: vals.append(''); last+=1
                    v=c.find('a:v',NS); val='' if v is None else v.text
                    if c.attrib.get('t')=='s' and val!='': val=ss[int(val)]
                    vals.append(val); last=col
                while vals and vals[-1]=='': vals.pop()
                if any(str(x)!='' for x in vals): rows.append(vals)
            out[name]=rows
        return out

def nnum(p):
    m=re.search(r'N-(\d+)|N(\d+)',p.name,re.I); return int(m.group(1) or m.group(2)) if m else None

def records(sheet):
    if not sheet: return [], []
    header=[str(x) for x in sheet[0]]
    if header and header[0] in ('campo','valor'): return header, sheet[1:]
    return header, sheet[1:] if any(not str(x).isdigit() for x in header) else sheet

def err(errors,p,s,row,msg): errors.append(f"{p}: hoja={s} fila={row}: {msg}")
def toint(x):
    if x in ('',None): return None
    return int(float(str(x).replace(',','.')))
def tof(x): return float(str(x).replace(',','.'))

def validate_percentil(p,sheet,sname,errors):
    h,rs=records(sheet); need=['edad_min_meses','edad_max_meses','tabla','area','escala','pd_original','pd_min','pd_max','limite_superior_abierto','percentil']
    if h[:len(need)]!=need: err(errors,p,sname,1,f"encabezados inesperados: {h}")
    tabs={r[2] for r in rs if len(r)>2}; areas={r[3] for r in rs if len(r)>3}; ages={(r[0],r[1]) for r in rs if len(r)>1}
    if tabs!={f'N-{nnum(p)}'}: err(errors,p,sname,0,f"tabla incoherente: {tabs}")
    if len(areas)!=1: err(errors,p,sname,0,f"área incoherente: {areas}")
    by={}
    for i,r in enumerate(rs,2):
        if len(r)<10: err(errors,p,sname,i,'fila incompleta'); continue
        try:
            pc=toint(r[9]); mn=toint(r[6]); mx=toint(r[7]); op=toint(r[8])
            if not (1<=pc<=99): err(errors,p,sname,i,f'percentil fuera de 1-99: {pc}')
            if op not in (0,1): err(errors,p,sname,i,'límite abierto inválido')
            by.setdefault(r[4],[]).append((mn,mx,op,pc,i))
        except Exception as e: err(errors,p,sname,i,f'valores no numéricos: {e}')
    for esc,vals in by.items():
        vals=sorted(vals,key=lambda x:x[0])
        seen=set(); prev=None; lastpc=-1; opens=0
        for mn,mx,op,pc,i in vals:
            if mn in seen: err(errors,p,sname,i,f'{esc}: duplicado PD_min {mn}')
            seen.add(mn); opens+=op
            if prev is not None and mn!=prev+1: err(errors,p,sname,i,f'{esc}: hueco/solapamiento tras {prev}, empieza {mn}')
            if pc<lastpc: err(errors,p,sname,i,f'{esc}: percentil decreciente')
            lastpc=pc; prev=mx if mx is not None else mn
        if opens>1: err(errors,p,sname,0,f'{esc}: más de un límite superior abierto')

def validate_n1(p,sheet,sname,errors):
    rows=sheet if sheet and str(sheet[0][0]).isdigit() else sheet[1:]
    if len(rows)!=99: err(errors,p,sname,0,f'N-1 debe tener 99 registros, tiene {len(rows)}')
    pcs=[]
    for i,r in enumerate(rows,1):
        if len(r)<5: err(errors,p,sname,i,'fila incompleta PC,z,T,CI,ECN'); continue
        pc=toint(r[0]); pcs.append(pc)
        if pc==50 and (round(tof(r[1]),2)!=0 or toint(r[2])!=50 or toint(r[3])!=100 or toint(r[4])!=50): err(errors,p,sname,i,'PC 50 no coincide con z=0,T=50,CI=100,ECN=50')
    if sorted(pcs)!=list(range(1,100)): err(errors,p,sname,0,'PC 1-99 no únicos')

def validate_n2(p,sheet,sname,errors):
    h,rs=records(sheet); tramos=set(); by={}
    for i,r in enumerate(rs,2):
        if len(r)<6: err(errors,p,sname,i,'fila incompleta'); continue
        tramos.add(r[0]); by.setdefault(r[0],[]).append((toint(r[2]),toint(r[3]),toint(r[4]),toint(r[5]),i))
        if not (1<=toint(r[5])<=99): err(errors,p,sname,i,'centil inválido')
    if tramos!={'0-5','6-11','12-17','18-23','24-35','36-47','48-59','60-71','72-83','84-95'}: err(errors,p,sname,0,f'tramos incompletos: {sorted(tramos)}')
    for tramo,vals in by.items():
        vals=sorted(vals,key=lambda x:x[0]); prev=None; opens=sum(v[2] for v in vals)
        for mn,mx,op,pc,i in vals:
            if prev is not None and mn!=prev+1: err(errors,p,sname,i,f'{tramo}: hueco/solapamiento tras {prev}, empieza {mn}')
            prev=mx if mx is not None else mn
        if opens!=1: err(errors,p,sname,0,f'{tramo}: debe tener un límite superior abierto, tiene {opens}')

def allowed_n56_pd51_gap(n, vals, prev, mn):
    if n!=56 or prev!=50 or mn!=52: return False
    left=[v for v in vals if v[0]==48 and v[1]==50]
    right=[v for v in vals if v[0]==52 and v[1]==53]
    try:
        inc=json.loads((ROOT/'data/edades_equivalentes.json').read_text(encoding='utf-8')).get('excepciones_dominio',[])
    except Exception:
        inc=[]
    declared=any(e.get('tabla')=='N-56' and e.get('escala_id')=='personal_social_total' and e.get('pd')==51 and e.get('estado')=='pd_no_alcanzable_confirmada' for e in inc)
    return bool(left and right and declared)

def validate_eq(p,sheet,sname,errors):
    h,rs=records(sheet); m=re.match(r'N-(\d+)$',sname); n=int(m.group(1)) if m else nnum(p)
    maxcol='puntuacion_maxima'
    pmax=682 if n==65 else None
    vals=[]
    for i,r in enumerate(rs,2):
        if len(r)<10: err(errors,p,sname,i,'fila incompleta'); continue
        mn=toint(r[3]); mx=toint(r[4]); op=toint(r[5]); age=toint(r[7]); vals.append((mn,mx,op,age,i))
        if n==65 and len(r)>10 and toint(r[10])!=682: err(errors,p,sname,i,'N-65 máximo distinto de 682')
    vals=sorted(vals,key=lambda x:x[0]); prev=-1; lastage=-1
    for mn,mx,op,age,i in vals:
        if mn!=prev+1 and not allowed_n56_pd51_gap(n, vals, prev, mn): err(errors,p,sname,i,f'hueco/solapamiento tras {prev}, empieza {mn}')
        if age<lastage: err(errors,p,sname,i,'edad equivalente decreciente')
        lastage=age; prev=mx if mx is not None else mn
    if vals and vals[0][0]!=0: err(errors,p,sname,0,'PD no empieza en cero')
    if n==65:
        checks={386:37,421:41,436:43,464:47,537:57,562:60}
        for pd,age in checks.items():
            hit=[v for v in vals if v[0]<=pd and (v[1] is None or pd<=v[1])]
            if not hit or hit[0][3]!=age: err(errors,p,sname,0,f'N-65 comprobación {pd}→{age} falla')

def main():
    errors=[]; files=sorted((ROOT/'fuentes').rglob('*.xlsx'))
    expected=set(range(1,3))|set(range(3,53))|set(range(56,66))
    seen=set()
    datasets=[]
    for p in files:
        data=read_xlsx(p)
        for sname,sheet in data.items():
            if sname.lower().startswith('metadatos'): continue
            m=re.match(r'N-(\d+)$',sname)
            n=int(m.group(1)) if m else nnum(p)
            seen.add(n); datasets.append((p,n,sname,sheet))
    miss=expected-seen
    if miss: errors.append(f'faltan tablas esperadas: {sorted(miss)}')
    if len([n for n in seen if 3<=n<=52])!=50: errors.append('presencia exacta de N-3..N-52 incumplida')
    if len([n for n in seen if 56<=n<=65])!=10: errors.append('presencia exacta de N-56..N-65 incumplida')
    for p,n,sname,sheet in datasets:
        if n and 3<=n<=52: validate_percentil(p.relative_to(ROOT),sheet,sname,errors)
        elif n==1: validate_n1(p.relative_to(ROOT),sheet,sname,errors)
        elif n==2: validate_n2(p.relative_to(ROOT),sheet,sname,errors)
        elif n and 56<=n<=65: validate_eq(p.relative_to(ROOT),sheet,sname,errors)
    if errors:
        print('VALIDACIÓN FUENTES EXCEL: ERROR')
        print('\n'.join(errors)); return 1
    print(f'VALIDACIÓN FUENTES EXCEL: OK ({len(files)} archivos; tablas N-1, N-2, N-3..N-52 y N-56..N-65)')
    print('Confirmaciones: N-29 límite abierto/cobertura OK; N-56 PD 51 OK; N-2 18-23 sin solapamientos 254-257/253/251-252 OK')
    return 0
if __name__=='__main__': sys.exit(main())
