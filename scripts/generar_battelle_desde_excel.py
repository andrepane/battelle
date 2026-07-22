#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.battelle_parser.extract import extract

DEFAULT_OUTPUT_DIR = 'tmp/battelle_generado_excel'

if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Genera salidas reproducibles del parser Battelle desde los Excel fuente.')
    ap.add_argument('--source-xlsx', default='Battelle_Tablas_de_correccion.xlsx')
    ap.add_argument('--db-xlsx', default='Battelle_DB_transcripcion_v4_fuente_excel_indexada.xlsx')
    ap.add_argument('--output-dir', default=DEFAULT_OUTPUT_DIR)
    args = ap.parse_args()
    cov = extract(args.source_xlsx, args.db_xlsx, args.output_dir)
    print(json.dumps(cov, ensure_ascii=False, indent=2, sort_keys=True))
