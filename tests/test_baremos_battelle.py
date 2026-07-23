import json, unittest, subprocess, hashlib
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from battelle_excel.normalization import parse_pd
from battelle_excel.model import maximos_teoricos
from battelle_excel.xlsx_reader import read_workbook

class BaremosBattelleTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  subprocess.run([sys.executable,'scripts/generar_baremos_battelle.py'],cwd=ROOT,check=True)
  cls.pct=json.loads((ROOT/'data/percentiles_battelle.json').read_text(encoding='utf-8'))
  cls.pc=json.loads((ROOT/'data/conversion_pc_general.json').read_text(encoding='utf-8'))
  cls.total=json.loads((ROOT/'data/conversion_total_battelle.json').read_text(encoding='utf-8'))
  cls.ed=json.loads((ROOT/'data/edades_equivalentes.json').read_text(encoding='utf-8'))
 def test_lectura_real_xlsx(self):
  sheets=read_workbook(ROOT/'fuentes/conversiones_generales/N-1_conversion_PC_z_T_CI_ECN.xlsx')
  self.assertEqual(sheets[0]['name'],'N-1'); self.assertGreater(len(sheets[0]['rows']),90)
 def test_parse_pd(self):
  self.assertEqual(parse_pd('12')['pd_min'],12); self.assertEqual(parse_pd('12-13')['pd_max'],13); self.assertTrue(parse_pd('18+',170)['limite_superior_abierto'])
 def test_trazabilidad_excel(self):
  for obj in [self.pct,self.pc,self.total,self.ed]:
   for r in obj['registros']:
    if r.get('estado')=='pd_no_alcanzable_confirmada': continue
    self.assertIn('fuente',r); self.assertTrue(r['fuente']['archivo'].startswith('fuentes/')); self.assertIn('fila',r['fuente'])
 def test_maximos_teoricos(self):
  m=maximos_teoricos(); self.assertEqual(m['Battelle total'],682); self.assertEqual(m['Personal/Social'],170)
 def test_separacion_familias_y_conocidos(self):
  self.assertEqual(set(self.pc['tablas_incluidas']),{'N-1'}); self.assertEqual(set(self.total['tablas_incluidas']),{'N-2'})
  self.assertEqual(set(self.ed['tablas_incluidas']),{f'N-{i}' for i in range(56,66)})
  r50=next(r for r in self.pc['registros'] if r['pc']==50); self.assertEqual((r50['z'],r50['T'],r50['CI'],r50['ECN']),(0,50,100,50))
  for pd,mes in [(386,37),(421,41),(436,43),(464,47),(537,57),(562,60)]:
   r=next(r for r in self.ed['registros'] if r.get('tabla')=='N-65' and r.get('pd_min') is not None and r['pd_min']<=pd<=r['pd_max'])
   self.assertEqual(r['edad_equivalente_min_meses'],mes)
 def test_excepcion_n56_pd51(self):
  self.assertTrue(any(r.get('estado')=='pd_no_alcanzable_confirmada' and r.get('pd')==51 for r in self.ed['registros']))
  self.assertFalse(any(r.get('tabla')=='N-56' and r.get('escala')=='Personal-Social' and r.get('pd_min') is not None and r['pd_min']<=51<=r['pd_max'] for r in self.ed['registros']))
 def test_determinismo_canonico(self):
  def canon(path):
   o=json.loads(path.read_text(encoding='utf-8')); o.pop('fecha_generacion',None); return json.dumps(o,sort_keys=True)
  before={p.name:canon(p) for p in (ROOT/'data').glob('*battelle*.json')}
  subprocess.run([sys.executable,'scripts/generar_baremos_battelle.py'],cwd=ROOT,check=True)
  after={p.name:canon(p) for p in (ROOT/'data').glob('*battelle*.json')}
  self.assertEqual(before,after)

if __name__=='__main__': unittest.main()
