#!/usr/bin/env python3
import argparse, json, sys
from pathlib import Path

DEFAULT_OUTPUT_DIR = 'tmp/battelle_generado_excel'
KNOWN_AREAS = {'Personal-Social','Personal/Social','Adaptativa','Motora','Comunicación','Cognitiva',''}
REQUIRED_TRACE = ('origen_dato','hoja_fuente','celda_o_rango_fuente','texto_fuente','reglas_ocr_aplicadas','confianza_extraccion','requiere_revision','EstadoRevision')

def load_json(path):
    return json.loads(path.read_text(encoding='utf-8'))

def interval_key(r):
    return (r.get('Tabla'), r.get('Area',''), r.get('Subarea',''), r.get('EdadMinMeses',''), r.get('EdadMaxMeses',''), r.get('PDMin'), r.get('PDMax'))

def main():
    ap = argparse.ArgumentParser(description='Valida salidas generadas del parser Battelle.')
    ap.add_argument('--output-dir', default=DEFAULT_OUTPUT_DIR)
    args = ap.parse_args()
    p = Path(args.output_dir)
    inv = load_json(p/'inventario_tablas.json')
    pd = load_json(p/'pd_percentil.json')
    cov = load_json(p/'cobertura_validacion.json')
    usable = load_json(p/'registros_utilizables.json') if (p/'registros_utilizables.json').exists() else []
    errs=[]
    tabs={r['Tabla'] for r in inv}
    if len(tabs) != 52:
        errs.append(f'inventario no cubre N-1..N-52: {len(tabs)}')
    if cov['localizadas'] != len({r['Tabla'] for r in inv if r.get('estado_final')!='NO_LOCALIZADA'}):
        errs.append('conteo localizadas incoherente')
    if any(r['Tabla']=='N-1' for r in pd):
        errs.append('N-1 mezclada en PD')
    if any(r['Tabla']=='N-2' for r in pd):
        errs.append('N-2 mezclada en PD')
    if cov['checksum_protegido_antes'] != cov['checksum_protegido_despues']:
        errs.append('checksum protegido cambia')
    seen=set()
    for r in pd:
        for k in REQUIRED_TRACE:
            if k not in r:
                errs.append(f'registro sin trazabilidad {k}')
        if r.get('origen_dato') == 'excel_ocr' and r.get('EstadoRevision') == 'REVISADO_VISUALMENTE':
            errs.append('fila automática revisada visualmente')
        if r.get('Area','') not in KNOWN_AREAS:
            errs.append(f'área desconocida: {r.get("Area")}')
        if r.get('Percentil') != '':
            pct=int(r['Percentil'])
            if r in usable and not (1 <= pct <= 99): errs.append('percentil invalido')
        if r.get('PDMin') not in ('',None):
            if int(r['PDMin']) < 0: errs.append('PD negativa')
        if r.get('PDMax') not in ('', None):
            if int(r['PDMax']) < 0: errs.append('PD negativa')
            if int(r['PDMin']) > int(r['PDMax']): errs.append('intervalo invalido')
        if r in usable:
            k=interval_key(r)
            if k in seen: errs.append('intervalo duplicado')
            seen.add(k)
    for r in usable:
        if str(r.get('requiere_revision')).lower() in ('true','1','sí','si'):
            errs.append('fila dudosa en utilizable')
    print('OK' if not errs else '\n'.join(sorted(set(errs))))
    return 1 if errs else 0

if __name__ == '__main__':
    sys.exit(main())
