import time, http.cookiejar, urllib.request, urllib.parse
# isolate: time a deep page vs root once more; also tags shell
cj=http.cookiejar.CookieJar()
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def hit(label,url,data=None):
  t0=time.perf_counter()
  req=urllib.request.Request(url,data=data,method='POST' if data else 'GET')
  if data: req.add_header('Content-Type','application/x-www-form-urlencoded')
  with opener.open(req,timeout=180) as r: body=r.read(); code=r.status
  print(label, code, round((time.perf_counter()-t0)*1000), 'ms', len(body))
  return body
data=urllib.parse.urlencode({'cw_unlock':'1','codeword':'grepToday'}).encode()
hit('unlock','http://127.0.0.1:43210/?h=code.glass',data)
# index only
hit('glass_root','http://127.0.0.1:43210/?h=code.glass')
# tags
hit('tags','http://127.0.0.1:43210/?h=code.tags')
# count hosts discover would see via _hosts.yaml roam sources
from pathlib import Path
import os
roots=[]
# rough: all roam sources from yaml + host folders
for line in open(r'C:\ALICE_BOX\my-pocket-things\pocket-go\~hosts\_hosts.yaml',encoding='utf-8',errors='replace'):
  if 'source:' in line:
    src=line.split('source:',1)[1].strip().strip('"')
    if src: roots.append(src)
host_root=Path(r'C:\ALICE_BOX\my-pocket-things\pocket-go\~hosts')
for p in host_root.iterdir():
  if p.is_dir() and not p.name.startswith('_'):
    roots.append(str(p))
total=0
print('--- note counts per root (md+chip) ---')
for r in roots:
  p=Path(r)
  if not p.exists():
    print('MISSING', r); continue
  n=0
  for dp,_,fns in os.walk(p):
    for fn in fns:
      if fn.lower().endswith(('.md','.chip')): n+=1
  total+=n
  print(f'{n:5d} {r}')
print('TOTAL', total)
