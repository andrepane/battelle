#!/usr/bin/env python3
import json, re, sys
from collections import Counter, defaultdict

EXPECTED_COUNTS = {
    'Personal/Social': 85,
    'Adaptativa': 59,
    'Motora': 82,
    'Comunicación': 59,
    'Cognitiva': 56,
}
PREFIX_EXPECTED = {'PS':85,'A':59,'M':82,'CM':59,'CG':56}
REQUIRED = ['codigo','area','subarea','rango_edad_meses','enunciado','fuente','confianza']

def code_key(c):
    m=re.fullmatch(r'(PS|A|M|CM|CG)\s+(\d+)', c.strip())
    if not m: return None
    return m.group(1), int(m.group(2))

def main(path='data/items_areas_subareas.json'):
    data=json.load(open(path,encoding='utf-8'))
    items=data.get('items',[])
    errors=[]
    if len(items)!=341: errors.append(f'total inesperado: {len(items)} != 341')
    counts=Counter(i.get('area','') for i in items)
    for area, exp in EXPECTED_COUNTS.items():
        if counts[area]!=exp: errors.append(f'recuento {area}: {counts[area]} != {exp}')
    codes=[i.get('codigo','') for i in items]
    for c,n in Counter(codes).items():
        if n>1: errors.append(f'código duplicado: {c} ({n})')
    bypref=defaultdict(set)
    for c in codes:
        k=code_key(c)
        if not k: errors.append(f'formato de código inválido: {c!r}'); continue
        bypref[k[0]].add(k[1])
    for pref, exp in PREFIX_EXPECTED.items():
        missing=[n for n in range(1,exp+1) if n not in bypref[pref]]
        extra=sorted(n for n in bypref[pref] if n<1 or n>exp)
        if missing: errors.append(f'saltos en numeración {pref}: faltan {missing}')
        if extra: errors.append(f'numeración fuera de rango {pref}: {extra}')
    for idx,it in enumerate(items,1):
        for f in REQUIRED:
            v=it.get(f)
            if v in (None,'',[],{}): errors.append(f'campo obligatorio vacío: item #{idx} {it.get("codigo")} campo {f}')
        fuente=it.get('fuente',{})
        for f in ['documento','pagina_imagen']:
            if fuente.get(f) in (None,''): errors.append(f'fuente.{f} vacío: {it.get("codigo")}')
    declared={(a['nombre'],s['nombre'],code) for a in data.get('areas',[]) for s in a.get('subareas',[]) for code in s.get('items',[])}
    actual={(i['area'],i['subarea'],i['codigo']) for i in items}
    if declared != actual:
        errors.append(f'desajuste áreas/subáreas: declarados-no-items={len(declared-actual)}, items-no-declarados={len(actual-declared)}')
    print('Validación Battelle')
    print(f'Total ítems: {len(items)}')
    print('Recuentos por área:')
    for area in EXPECTED_COUNTS: print(f'  {area}: {counts[area]}')
    if errors:
        print('ERRORES:')
        for e in errors: print(f'  - {e}')
        return 1
    print('OK: total, recuentos, códigos, campos obligatorios y subáreas coinciden.')
    return 0
if __name__ == '__main__': sys.exit(main(*(sys.argv[1:])))
