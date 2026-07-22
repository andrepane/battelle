#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.battelle_parser.extract import extract
if __name__=='__main__':
 import json
 cov=extract('Battelle_Tablas_de_correccion.xlsx','Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx','data/generado_excel')
 print(json.dumps(cov,ensure_ascii=False,indent=2,sort_keys=True))
