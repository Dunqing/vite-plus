import json,zipfile,re
from pathlib import Path
P=Path(__file__).parent;state=json.loads((P/'state.json').read_text());output=[]
for r in state['runs']:
 if r['cache']=='prime':continue
 d=json.loads((P/f"{r['id']}.json").read_text())
 if d['status']!='completed' or d['conclusion']!='success':continue
 zp=P/f"{r['id']}-logs.zip"
 if not zp.exists() or not zipfile.is_zipfile(zp):continue
 z=zipfile.ZipFile(zp);jobs=[]
 for n in z.namelist():
  if '/' in n or not n.endswith('.txt'):continue
  t=z.read(n).decode('utf8',errors='replace')
  restored=re.findall(r'Cache restored from key: ([^\r\n\x1b]+)',t)+re.findall(r'Restored from cache key "([^"]+)" full match: true',t)
  saved=re.findall(r'Cache saved with key: ([^\r\n\x1b]+)',t)
  missing=[l for l in t.splitlines() if 'No cache found.' in l or 'Cache not found for input keys:' in l]
  required=len(re.findall(r'CACHE_HIT: true',t))
  repos=re.findall(r'INPUT_REPOSITORY (\S+) ([0-9a-f]{40})',t)
  jobs.append({'name':n,'restored_keys':restored,'saved_keys':saved,'missing':missing,'exact_cargo_hits':required,'install_repos':repos,'tool_cache_messages':[l for l in t.splitlines() if any(q in l for q in ['Using cached Zig installation','Cache miss. Fetching Zig','Fetch took','Extract took'])]})
 assert not any(j['saved_keys'] for j in jobs),('Unexpected cache write',r)
 if r['cache']=='cold':assert not any(j['restored_keys'] for j in jobs),('Unexpected cold cache restore',r)
 if r['cache']=='warm':
  assert not any(j['missing'] for j in jobs),('Unexpected warm cache miss',r)
  assert sum(j['exact_cargo_hits'] for j in jobs)==(8 if r['variant']=='before' else 9),r
  assert sum(len(j['restored_keys']) for j in jobs)==(21 if r['variant']=='before' else 28),r
 repos=dict(kv for j in jobs for kv in j['install_repos'])
 assert len(repos)==6,(r,repos)
 output.append({'run':r,'scope':'Cargo, pnpm, SDK, native binaries and test archives; runner/tool caches are separate.','install_refs':repos,'jobs':jobs})
 print(r['id'],r['variant'],r['cache'],'restores',sum(len(j['restored_keys']) for j in jobs),'Cargo exact hits',sum(j['exact_cargo_hits'] for j in jobs),'cache writes',sum(len(j['saved_keys']) for j in jobs))
if output:assert all(r['install_refs']==output[0]['install_refs'] for r in output)
(P/'cache-audit.json').write_text(json.dumps(output,indent=2)+'\n')
