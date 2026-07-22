import unittest, json, tempfile, shutil
from scripts.battelle_parser.detect import detect_titles, delimit_blocks, classify
from scripts.battelle_parser.normalization import parse_pd_token, normalize_ocr
from scripts.battelle_parser.extract import ST_REVIEW
class T(unittest.TestCase):
 def test_titles_blocks(self):
  wb={'sheets':[{'name':'S','max_row':20,'max_col':2,'cells':[type('C',(),{'sheet':'S','row':1,'col':1,'coord':'A1','value':'Tabla N-1 conversión'})(),type('C',(),{'sheet':'S','row':10,'col':1,'coord':'A10','value':'N-2 especial'})()]}]}
  ts=detect_titles(wb); self.assertEqual([t['Tabla'] for t in ts],['N-1','N-2']); self.assertEqual(delimit_blocks(ts,wb)[0]['end_row'],9)
 def test_pd_tokens(self):
  self.assertEqual(parse_pd_token('18+')['PDMin'],18); self.assertIsNone(parse_pd_token('18+')['PDMax'])
  self.assertEqual(parse_pd_token('12-13')['PDMax'],13); self.assertEqual(parse_pd_token('7')['PDMax'],7)
  self.assertIsNone(parse_pd_token('0-5', is_age_context=True))
 def test_ocr_contextual(self):
  self.assertEqual(normalize_ocr('PO','pd_header')['normalized'],'PD')
  self.assertEqual(normalize_ocr('1O- l2')['normalized'],'10-12')
  self.assertTrue(normalize_ocr('Comunicación 1O')['requires_review'])
 def test_classify(self):
  self.assertEqual(classify('N-1 conversión',1),'CONVERSION_PC_Z_T_CI_ECN')
  self.assertEqual(classify('N-2 tabla',2),'TABLA_ESPECIAL_N2')
 def test_overlap_duplicate_gap_logic(self):
  toks=[parse_pd_token(x) for x in ['0-2','2-3','5']]
  self.assertTrue(toks[0]['PDMax']>=toks[1]['PDMin'])
  self.assertTrue(toks[1]['PDMax']+1<toks[2]['PDMin'])
 def test_deterministic_json(self):
  a=json.dumps([{'b':1,'a':2}],sort_keys=True); self.assertEqual(a,json.dumps([{'a':2,'b':1}],sort_keys=True))
 def test_preservation_state_constant(self): self.assertEqual(ST_REVIEW,'REVISADO_VISUALMENTE')
if __name__=='__main__': unittest.main()

class RegressionMissingTables(unittest.TestCase):
 def test_fragmented_and_deformed_titles_for_initially_missing_tables(self):
  Cell=lambda row,col,coord,value: type('C',(),{'sheet':'S','row':row,'col':col,'coord':coord,'value':value})()
  wb={'sheets':[{'name':'S','max_row':120,'max_col':3,'cells':[
   Cell(1,1,'A1','Tabla N-3. Área Personal-Social Tabla N-4. Área Adaptativa'),
   Cell(10,1,'A10','Tabla N-8. Área Personal-Social Tabla N-9. Área Adaptativa'),
   Cell(20,1,'A20','Tabla N-11. Área Comunicación Tabla N-12. Área Cognitiva'),
   Cell(30,1,'A30','Tabla N-16. Área Comunicación Tabla N-17. Área Cognitiva'),
   Cell(40,1,'A40','Tabla N•19. Área Adaptativa'),
   Cell(50,1,'A50','Tabla N-21. Área Comunicación Tabla N-22. Área Cognitiva'),
   Cell(60,1,'A60','Tabla N-31. Área Comunicación Tabla N-32. Área Cognitiva'),
   Cell(70,1,'A70','Tabla N-41. Área Comunicación Tabla N-42. Área Cognitiva'),
   Cell(80,1,'A80','Tabla N-46. Área Comunicación Tabla N-47. Área Cognitiva'),
  ]}]}
  tabs={t['Tabla'] for t in detect_titles(wb)}
  for tab in ['N-4','N-9','N-10','N-12','N-17','N-19','N-22','N-32','N-42','N-47']:
   self.assertIn(tab,tabs)

class RealExcelIntegration(unittest.TestCase):
 def test_real_excels_detection_preservation_and_idempotence(self):
  from pathlib import Path
  from scripts.battelle_parser.xlsx_io import read_workbook
  from scripts.battelle_parser.extract import extract, protected_rows
  if not Path('Battelle_Tablas_de_correccion.xlsx').exists() or not Path('Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx').exists():
   self.skipTest('Excel reales no disponibles')
  wb=read_workbook('Battelle_Tablas_de_correccion.xlsx')
  tabs={t['Tabla'] for t in detect_titles(wb)}
  self.assertEqual(len(tabs),52)
  for tab in ['N-4','N-9','N-10','N-12','N-17','N-19','N-22','N-32','N-42','N-47']:
   self.assertIn(tab,tabs)
  prot, checksum=protected_rows('Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx')
  self.assertEqual(len(prot),461)
  self.assertEqual(checksum,'46fa96209bafccd9b1070da0b2617908f3e34bb0c317ebb3cc242badca45999d')
  import tempfile, hashlib, os
  def hashes(d):
   out=[]
   for path in sorted(Path(d).rglob('*')):
    if path.is_file(): out.append((str(path.relative_to(d)), hashlib.sha256(path.read_bytes()).hexdigest()))
   return out
  with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
   ca=extract('Battelle_Tablas_de_correccion.xlsx','Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx',a)
   cb=extract('Battelle_Tablas_de_correccion.xlsx','Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx',b)
   self.assertEqual(ca['checksum_protegido_antes'], ca['checksum_protegido_despues'])
   self.assertEqual(ca, cb)
   self.assertEqual(hashes(a), hashes(b))

class ComparisonAndSets(unittest.TestCase):
 def test_canonical_key_and_percentile_difference(self):
  from scripts.battelle_parser.extract import canonical_key_record, compare_active
  a={'tabla':'N-3','edad_cronologica_min_meses':0,'edad_cronologica_max_meses':5,'escala':'Autoconcepto','puntuacion_directa_min':6,'puntuacion_directa_max':'','valor_original_pd':'6+','percentil':96}
  r={'Tabla':'N-3','EdadMinMeses':'0','EdadMaxMeses':'5','Subarea':'Autoconcepto','PDMin':'6','PDMax':'','LimiteSuperiorAbierto':'1','Percentil':95,'origen_dato':'excel_ocr'}
  self.assertEqual(canonical_key_record(a), canonical_key_record(r))
 def test_mutually_exclusive_sets_no_n3_n12_duplication(self):
  from scripts.battelle_parser.extract import split_sets
  rows=[{'Tabla':'N-3','EdadMinMeses':'0','EdadMaxMeses':'5','Subarea':'A','PDMin':'1','PDMax':'1','LimiteSuperiorAbierto':'0','Percentil':'50','origen_dato':'v4_revisado'}, {'Tabla':'N-13','EdadMinMeses':'12','EdadMaxMeses':'23','Subarea':'B','PDMin':'1','PDMax':'1','LimiteSuperiorAbierto':'0','Percentil':'50','origen_dato':'excel_ocr'}]
  p,c,pend,rej,dup=split_sets(rows)
  self.assertEqual((len(p),len(c),len(pend),len(rej),len(dup)),(1,0,1,0,0))
  self.assertEqual(len(p),1)
 def test_title_observed_vs_inferred_and_shared_row_blocks(self):
  Cell=lambda row,col,coord,value: type('C',(),{'sheet':'S','row':row,'col':col,'coord':coord,'value':value})()
  wb={'sheets':[{'name':'S','max_row':25,'max_col':1,'cells':[Cell(1,1,'A1','Tabla N-8 Tabla N-9'),Cell(20,1,'A20','Tabla N-11')]}]}
  titles=detect_titles(wb)
  self.assertTrue(any(t['Tabla']=='N-10' and t.get('reconstructed') for t in titles))
  self.assertTrue(any(t['Tabla']=='N-9' and not t.get('reconstructed') for t in titles))
  blocks=delimit_blocks(titles,wb)
  self.assertTrue(all(b['end_row']>=b['start_row'] for b in blocks))
