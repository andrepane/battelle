import re
DASHES='–—−'
def normalize_spaces(s): return re.sub(r'\s+',' ',str(s).replace('\n',' ')).strip()
def normalize_ocr(text, context=''):
 orig=str(text); s=normalize_spaces(orig); rules=[]; review=False; conf=1.0
 for d in DASHES:
  if d in s: s=s.replace(d,'-'); rules.append('guion_tipografico')
 if context=='pd_header' and re.fullmatch(r'P[OD]',s,re.I):
  if s.upper()!='PD': rules.append('PO_a_PD_encabezado')
  s='PD'
 def repl(m):
  nonlocal rules
  t=m.group(0); nt=t.translate(str.maketrans({'O':'0','o':'0','I':'1','l':'1','|':'1'}))
  if nt!=t: rules.append('ocr_numerico_contextual')
  return nt
 if re.fullmatch(r'[0-9OIoOl|]+(?:\s*-\s*[0-9OIoOl|]+)?\+?',s):
  s=repl(re.match(r'.*',s)).replace(' -','-').replace('- ','-')
 elif any(ch in s for ch in 'OIl|') and re.search(r'\d',s): review=True; conf=.4; rules.append('ocr_ambiguo_sin_sustituir')
 return {'original':orig,'normalized':s,'rules':rules,'confidence':conf,'requires_review':review}
def parse_pd_token(tok, is_age_context=False):
 t=normalize_ocr(tok)['normalized'].replace(' ','')
 if is_age_context: return None
 if re.fullmatch(r'\d+\+',t): return {'PDTexto':t,'PDMin':int(t[:-1]),'PDMax':None,'LimiteSuperiorAbierto':True}
 m=re.fullmatch(r'(\d+)-(\d+)',t)
 if m: return {'PDTexto':t,'PDMin':int(m.group(1)),'PDMax':int(m.group(2)),'LimiteSuperiorAbierto':False}
 if re.fullmatch(r'\d+',t): return {'PDTexto':t,'PDMin':int(t),'PDMax':int(t),'LimiteSuperiorAbierto':False}
 return None
