import re
from .normalization import normalize_spaces
TITLE_RE=re.compile(r'\bN\s*[-–—]?\s*(\d{1,2})\b',re.I)
def detect_titles(workbook):
 out=[]
 for sh in workbook['sheets']:
  for c in sh['cells']:
   txt=normalize_spaces(c.value)
   m=TITLE_RE.search(txt)
   if m and 1<=int(m.group(1))<=52:
    out.append({'Tabla':f"N-{int(m.group(1))}",'n':int(m.group(1)),'sheet':sh['name'],'row':c.row,'col':c.col,'coord':c.coord,'title':txt})
 return out
def delimit_blocks(titles, workbook):
 titles=sorted(titles,key=lambda x:(x['sheet'],x['row'],x['col'],x['n']))
 res=[]
 for i,t in enumerate(titles):
  same=[x for x in titles[i+1:] if x['sheet']==t['sheet']]
  end=(same[0]['row']-1) if same else next(s['max_row'] for s in workbook['sheets'] if s['name']==t['sheet'])
  res.append({**t,'start_row':t['row'],'end_row':end})
 return res
def classify(title, n):
 tl=title.lower()
 if n==1: return 'CONVERSION_PC_Z_T_CI_ECN'
 if n==2: return 'TABLA_ESPECIAL_N2'
 return 'PD_A_PERCENTIL'
