import re
from .normalization import normalize_spaces
TITLE_RE=re.compile(r'\bN\s*[-–—•·.:;]?\s*(\d{1,2})\b',re.I)
AREAS=('Personal-Social','Adaptativa','Motora','Comunicación','Cognitiva')

def _title_fragment(text, match, next_match=None):
 end=next_match.start() if next_match else len(text)
 start=max(0, match.start()-20)
 return normalize_spaces(text[start:end])

def detect_titles(workbook):
 out=[]
 for sh in workbook['sheets']:
  for c in sh['cells']:
   txt=normalize_spaces(c.value)
   matches=list(TITLE_RE.finditer(txt))
   for idx,m in enumerate(matches):
    n=int(m.group(1))
    if 1<=n<=52:
     out.append({'Tabla':f"N-{n}",'n':n,'sheet':sh['name'],'row':c.row,'col':c.col,'coord':c.coord,'title':_title_fragment(txt,m,matches[idx+1] if idx+1<len(matches) else None),'title_source':txt,'match_index':idx})
 out=sorted(out,key=lambda x:(x['sheet'],x['row'],x['col'],x['match_index'],x['n']))
 # OCR sometimes drops a title that is visually continued between two consecutive
 # table headers. Reconstruct only single-number gaps bounded by adjacent titles
 # on the same sheet; this is a general sequence rule, not a row whitelist.
 supplemented=list(out)
 present={(x['sheet'],x['n']) for x in out}
 for a,b in zip(out,out[1:]):
  if a['sheet']==b['sheet'] and b['n']==a['n']+2 and (a['sheet'],a['n']+1) not in present:
   n=a['n']+1
   supplemented.append({'Tabla':f"N-{n}",'n':n,'sheet':a['sheet'],'row':a['row']+1,'col':a['col'],'coord':a['coord'],'title':f"Tabla N-{n}. Título reconstruido por secuencia entre {a['Tabla']} y {b['Tabla']}",'title_source':f"{a.get('title_source',a['title'])} || {b.get('title_source',b['title'])}",'match_index':99,'reconstructed':True})
 return sorted(supplemented,key=lambda x:(x['sheet'],x['row'],x['col'],x['match_index'],x['n']))

def delimit_blocks(titles, workbook):
 titles=sorted(titles,key=lambda x:(x['sheet'],x['row'],x['col'],x.get('match_index',0),x['n']))
 res=[]
 for i,t in enumerate(titles):
  later=[x for x in titles[i+1:] if x['sheet']==t['sheet'] and x['row']>t['row']]
  end=(later[0]['row']-1) if later else next(s['max_row'] for s in workbook['sheets'] if s['name']==t['sheet'])
  res.append({**t,'start_row':t['row'],'end_row':max(t['row'],end)})
 return res

def classify(title, n):
 tl=title.lower()
 if n==1: return 'CONVERSION_PC_Z_T_CI_ECN'
 if n==2: return 'TABLA_ESPECIAL_N2'
 return 'PD_A_PERCENTIL'

def detect_area(title):
 low=title.lower()
 for a in AREAS:
  if a.lower() in low: return a
 return ''
