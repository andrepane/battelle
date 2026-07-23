from collections import defaultdict
EXPECTED=[f'N-{i}' for i in range(3,53)]

def no_overlap_gap(regs, exceptions=()):
 errs=[]
 for key, xs in defaultdict(list, {}).items(): pass
 groups=defaultdict(list)
 for r in regs:
  if 'pd_min' in r and r.get('pd_max') is not None: groups[(r.get('tabla'),r.get('tramo_cronologico'),r.get('escala'))].append(r)
 for k,xs in groups.items():
  xs=sorted(xs,key=lambda r:r['pd_min']); prev=None
  for r in xs:
   if prev is not None:
    if r['pd_min']<=prev: errs.append(f'solapamiento {k} {prev}-{r["pd_max"]}')
    if r['pd_min']>prev+1 and not (k[0]=='N-56' and k[2]=='Personal-Social' and prev==50 and r['pd_min']==52): errs.append(f'hueco {k} {prev+1}-{r["pd_min"]-1}')
   prev=r['pd_max']
 return errs
