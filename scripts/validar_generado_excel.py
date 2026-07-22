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
    protected = load_json(p/'utilizables_protegidos_v4.json') if (p/'utilizables_protegidos_v4.json').exists() else []
    cotejados = load_json(p/'utilizables_cotejados_con_datos_activos.json') if (p/'utilizables_cotejados_con_datos_activos.json').exists() else []
    pending = load_json(p/'registros_pendientes_revision.json') if (p/'registros_pendientes_revision.json').exists() else []
    rejected = load_json(p/'registros_rechazados.json') if (p/'registros_rechazados.json').exists() else []
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
    def rid(r): return str(r.get('origen_dato'))+'|'+str(r.get('Tabla'))+'|'+str(r.get('hoja_fuente'))+'|'+str(r.get('celda_o_rango_fuente'))+'|'+str(r.get('PDMin'))+'|'+str(r.get('PDMax'))+'|'+str(r.get('Percentil'))
    sets=[protected,cotejados,pending,rejected]
    all_ids=[]
    for ss in sets: all_ids.extend(rid(r) for r in ss)
    if len(all_ids) != len(set(all_ids)): errs.append('intersección no vacía o identificador duplicado entre conjuntos')
    if len(all_ids) != len(pd): errs.append('unión de conjuntos no suma total')
    if cov.get('utilizables_protegidos_v4') != len(protected): errs.append('conteo protegidos incoherente')
    if cov.get('utilizables_cotejados_con_datos_activos') != len(cotejados): errs.append('conteo cotejados incoherente')
    if cov.get('automaticos_pendientes_revision') != len(pending): errs.append('conteo pendientes incoherente')
    if cov.get('rechazados') != len(rejected): errs.append('conteo rechazados incoherente')
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
