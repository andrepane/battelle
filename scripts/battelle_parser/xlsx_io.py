from __future__ import annotations
import re, zipfile, xml.etree.ElementTree as ET
from pathlib import Path
from dataclasses import dataclass
NS={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
@dataclass(frozen=True)
class Cell: sheet:str; row:int; col:int; coord:str; value:str

def col_to_num(s):
 n=0
 for ch in s: n=n*26+ord(ch)-64
 return n

def read_workbook(path):
 path=Path(path); z=zipfile.ZipFile(path)
 shared=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  root=ET.fromstring(z.read('xl/sharedStrings.xml'))
  for si in root.findall('a:si',NS):
   shared.append(''.join(t.text or '' for t in si.findall('.//a:t',NS)))
 wb=ET.fromstring(z.read('xl/workbook.xml'))
 rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
 rid_to_target={r.attrib['Id']:r.attrib['Target'] for r in rels}
 sheets=[]
 for s in wb.find('a:sheets',NS):
  name=s.attrib['name']; rid=s.attrib['{'+NS['r']+'}id']; target=rid_to_target[rid]
  p=target.lstrip('/')
  if p.startswith('xl/'): pass
  elif p.startswith('/xl/'): p=p[1:]
  else: p='xl/'+p
  root=ET.fromstring(z.read(p))
  cells=[]; maxr=maxc=0
  for c in root.findall('.//a:c',NS):
   coord=c.attrib.get('r',''); m=re.match(r'([A-Z]+)(\d+)',coord); 
   if not m: continue
   col=col_to_num(m.group(1)); row=int(m.group(2)); maxr=max(maxr,row); maxc=max(maxc,col)
   typ=c.attrib.get('t'); txt=''
   if typ=='inlineStr': txt=''.join(t.text or '' for t in c.findall('.//a:t',NS))
   else:
    v=c.find('a:v',NS)
    if v is not None and v.text is not None:
     txt=shared[int(v.text)] if typ=='s' else v.text
   if txt!='': cells.append(Cell(name,row,col,coord,str(txt)))
  sheets.append({'name':name,'cells':cells,'max_row':maxr,'max_col':maxc})
 return {'path':str(path),'sheets':sheets}
