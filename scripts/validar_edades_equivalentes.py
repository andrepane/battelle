#!/usr/bin/env python3
import json, sys
from pathlib import Path

DATA=Path('data/edades_equivalentes.json')
INV=Path('data/inventario_tablas.json')
MAXIMOS={
    'N-55': 192,
    'N-56': 170,
    'N-57': 118,
    'N-58': 88,
    'N-59': 76,
    'N-60': 164,
    'N-61': 54,
    'N-62': 64,
    'N-63': 118,
    'N-64': 112,
    'N-65': 682,
}
N65_CHECKS={386:37,421:41,436:43,464:47,537:57,562:60}

def load_pages():
    inv=json.loads(INV.read_text(encoding='utf-8'))
    pages={}
    def walk(x):
        if isinstance(x,dict):
            if x.get('numero_oficial') and x.get('pagina_pdf') is not None:
                pages[x['numero_oficial']]=x['pagina_pdf']
            for v in x.values(): walk(v)
        elif isinstance(x,list):
            for v in x: walk(v)
    walk(inv)
    return pages

def main():
    data=json.loads(DATA.read_text(encoding='utf-8'))
    pages=load_pages()
    errs=[]
    tablas={tab.get('tabla'):tab for tab in data.get('escalas',{}).values()}
    for n in range(54,66):
        tabla=f'N-{n}'
        if tabla not in tablas:
            errs.append(f'Falta {tabla}')
            continue
        regs=tablas[tabla].get('registros',[])
        if not regs:
            errs.append(f'{tabla}: no tiene registros normalizados')
        expected_page=pages.get(tabla)
        for r in regs:
            for f in ['puntuacion_min','puntuacion_max','edad_equivalente_min_meses','edad_equivalente_max_meses','pagina_pdf']:
                if not isinstance(r.get(f),int) or r[f] < 0:
                    errs.append(f'{tabla}: campo numérico inválido {f} en {r}')
            if not isinstance(r.get('puntuacion_limite_abierto'),bool):
                errs.append(f'{tabla}: falta puntuacion_limite_abierto booleano en {r}')
            if r.get('puntuacion_min',0) > r.get('puntuacion_max',-1):
                errs.append(f'{tabla}: intervalo de puntuación invertido en {r}')
            if r.get('edad_equivalente_min_meses',0) > r.get('edad_equivalente_max_meses',-1):
                errs.append(f'{tabla}: intervalo de edad invertido en {r}')
            if not r.get('valor_original_puntuacion') or not r.get('valor_original_edad'):
                errs.append(f'{tabla}: no conserva valores originales en {r}')
            if expected_page is not None and r.get('pagina_pdf') != expected_page:
                errs.append(f'{tabla}: página {r.get("pagina_pdf")} no coincide con inventario {expected_page}')
        if tabla in MAXIMOS and regs:
            regs=sorted(regs,key=lambda x:(x['puntuacion_min'],x['puntuacion_max']))
            expected=0
            for r in regs:
                if r['puntuacion_min'] != expected:
                    errs.append(f'{tabla}: hueco o solape antes de PD {r["puntuacion_min"]}; se esperaba {expected}')
                expected=r['puntuacion_max']+1
            maximo=MAXIMOS[tabla]
            if expected != maximo+1:
                errs.append(f'{tabla}: cobertura termina en {expected-1}, esperado {maximo}')
            for r in regs:
                if r['puntuacion_limite_abierto'] and r['puntuacion_max'] != maximo:
                    errs.append(f'{tabla}: límite abierto no extendido al máximo teórico {maximo}: {r}')
    n65=tablas.get('N-65',{}).get('registros',[])
    lookup={}
    for r in n65:
        for pd in range(r['puntuacion_min'], r['puntuacion_max']+1):
            lookup[pd]=r['edad_equivalente_min_meses']
    for pd,edad in N65_CHECKS.items():
        if lookup.get(pd) != edad:
            errs.append(f'N-65: PD {pd} -> {lookup.get(pd)}, esperado {edad}')
    if errs:
        print('\n'.join(errs))
        sys.exit(1)
    print('OK: N-54..N-65 normalizadas y validadas con cobertura continua hasta máximos teóricos.')

if __name__ == '__main__':
    main()
