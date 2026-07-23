def buscar_edad_equivalente(normas, tabla, escala_id, pd):
 for exc in normas.get('excepciones_dominio', []):
  if exc.get('tabla') == tabla and exc.get('escala_id') == escala_id and exc.get('pd') == pd:
   return {'estado': 'pd_no_alcanzable', 'excepcion': exc}
 for r in normas.get('registros', []):
  if r.get('tabla') == tabla and r.get('escala_id') == escala_id and r.get('pd_min') is not None and r['pd_min'] <= pd <= r.get('pd_max', -1):
   return {'estado': 'ok', 'registro': r}
 return {'estado': 'baremo_no_encontrado'}
