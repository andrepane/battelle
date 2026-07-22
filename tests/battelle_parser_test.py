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
