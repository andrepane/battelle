#!/usr/bin/env python3
import json, sys
from pathlib import Path

EXPECTED={
'N-3': {'pagina':1,'escalas': {'Interacción con el adulto':36,'Expresión de sentimientos/afecto':24,'Autoconcepto':28,'Personal/Social total':88}},
'N-4': {'pagina':2,'escalas': {'Atención':20,'Comida':28,'Adaptativa total':48}},
'N-5': {'pagina':3,'escalas': {'Control muscular':12,'Coordinación corporal':50,'Motricidad fina':36,'Motora gruesa':62,'Motora fina':76,'Motora total':88}},
'N-6': {'pagina':4,'escalas': {'Receptiva':54,'Expresiva':64,'Comunicación total':118}},
'N-7': {'pagina':5,'escalas': {'Discriminación perceptiva':20,'Memoria':20,'Cognitiva total':40}},
}

def fail(msg):
    print(f'ERROR: {msg}', file=sys.stderr); return 1

def main():
    path=Path('data/percentiles_battelle.json')
    data=json.loads(path.read_text(encoding='utf-8'))
    registros=[]
    for tramo in data.get('tramos',[]):
        if tramo.get('edad_cronologica_min_meses')==0 and tramo.get('edad_cronologica_max_meses')==5:
            registros.extend(tramo.get('registros',[]))
    if not registros: return fail('no hay registros para 0-5 meses')
    if any(r.get('valores')==[] for r in registros): return fail('hay filas con valores: []')
    errors=[]
    tabs={r.get('tabla') for r in registros}
    if tabs != set(EXPECTED): errors.append(f'tablas esperadas {set(EXPECTED)}, encontradas {tabs}')
    by={}
    for r in registros:
        if r.get('edad_cronologica_min_meses')!=0 or r.get('edad_cronologica_max_meses')!=5: errors.append(f'edad no 0-5: {r}')
        pc=r.get('percentil')
        if not isinstance(pc,int) or not (1<=pc<=99): errors.append(f'percentil inválido: {r}')
        tab=r.get('tabla'); esc=r.get('escala')
        if tab in EXPECTED and r.get('pagina_pdf')!=EXPECTED[tab]['pagina']: errors.append(f'página inválida {tab}/{esc}: {r.get("pagina_pdf")}')
        if tab in EXPECTED and esc not in EXPECTED[tab]['escalas']: errors.append(f'escala no esperada en {tab}: {esc}')
        by.setdefault((tab,esc),[]).append(r)
    for tab,meta in EXPECTED.items():
        for esc,maxpd in meta['escalas'].items():
            rs=by.get((tab,esc),[])
            if not rs:
                errors.append(f'falta escala {tab} {esc}'); continue
            covered={}
            for r in rs:
                a,b=r['puntuacion_directa_min'],r['puntuacion_directa_max']
                if not (0<=a<=b<=maxpd): errors.append(f'intervalo fuera de rango {tab} {esc}: {a}-{b} max {maxpd}')
                for pd in range(a,b+1):
                    if pd in covered: errors.append(f'solapamiento {tab} {esc} PD {pd}')
                    covered[pd]=r
            missing=[pd for pd in range(maxpd+1) if pd not in covered]
            if missing: errors.append(f'huecos {tab} {esc}: {missing[:20]}')
            # separación de columnas: cada escala debe tener al menos dos registros y no compartir objeto valores[]
            if len(rs)<2: errors.append(f'posible columna sin separar {tab} {esc}')
    if errors:
        for e in errors: print('ERROR:',e,file=sys.stderr)
        return 1
    print(f'OK: {len(registros)} registros validados para N-3 a N-7 (0-5 meses).')
    return 0
if __name__=='__main__': sys.exit(main())
