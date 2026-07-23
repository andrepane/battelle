from __future__ import annotations
import zipfile, xml.etree.ElementTree as ET, hashlib, re
from pathlib import Path
NS={'a':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}

def sha256_file(path):
 h=hashlib.sha256();
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(65536),b''): h.update(b)
 return h.hexdigest()

def colrow(ref):
 m=re.match(r'([A-Z]+)(\d+)',ref); col=0
 for ch in m.group(1): col=col*26+ord(ch)-64
 return col,int(m.group(2))

def read_workbook(path):
 path=Path(path); z=zipfile.ZipFile(path)
 ss=[]
 if 'xl/sharedStrings.xml' in z.namelist():
  root=ET.fromstring(z.read('xl/sharedStrings.xml'))
  for si in root.findall('a:si',NS): ss.append(''.join(t.text or '' for t in si.findall('.//a:t',NS)))
 wb=ET.fromstring(z.read('xl/workbook.xml'))
 rels=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
 relmap={r.attrib['Id']:r.attrib['Target'] for r in rels}
 out=[]
 for sh in wb.find('a:sheets',NS):
  name=sh.attrib['name']; rid=sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
  target=relmap[rid].lstrip('/'); p=target if target.startswith('xl/') else 'xl/'+target
  root=ET.fromstring(z.read(p)); rows=[]
  for row in root.findall('.//a:sheetData/a:row',NS):
   vals={}
   for c in row.findall('a:c',NS):
    ref=c.attrib.get('r'); v=c.find('a:v',NS); txt=''
    if v is not None:
     txt=v.text or ''
     if c.attrib.get('t')=='s': txt=ss[int(txt)]
    elif c.attrib.get('t')=='inlineStr':
     txt=''.join(t.text or '' for t in c.findall('.//a:t',NS))
    if ref: vals[colrow(ref)[0]]=txt
   if vals: rows.append({'row':int(row.attrib['r']),'values':vals})
  out.append({'name':name,'rows':rows})
 return out
