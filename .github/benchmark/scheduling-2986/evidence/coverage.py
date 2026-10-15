import json,zipfile,re,hashlib
from pathlib import Path
P=Path(__file__).parent;out=[]
for r in json.loads((P/'state.json').read_text())['runs']:
 p=P/f"{r['id']}-logs.zip"
 if r['cache']=='prime' or r.get('conclusion')!='success' or not p.exists() or not zipfile.is_zipfile(p):continue
 z=zipfile.ZipFile(p);totals={};names={}
 for n in z.namelist():
  if '/' in n or not n.endswith('.txt'):continue
  if 'CLI snapshot test' in n:group='snapshot-'+('windows' if 'Windows' in n else 'macos' if 'apple' in n else 'linux')
  elif 'Test (Windows' in n:group='unit-windows'
  elif 'Test (Linux x64 musl)' in n:group='unit-musl'
  elif 'Test (namespace-profile-mac-default' in n:group='unit-macos'
  elif 'Test (namespace-profile-linux-x64-default' in n:group='unit-linux'
  elif 'Build CLI test binaries' in n:group='utilities-'+('macos' if 'apple' in n else 'linux')
  else:continue
  t=re.sub(r'\x1b\[[0-9;]*m','',z.read(n).decode(errors='replace'))
  passed=sum(int(x) for x in re.findall(r'Summary \[[^\]]+\] \d+ tests? run: (\d+) passed',t))
  passed+=sum(int(x) for x in re.findall(r'test result: ok\. (\d+) passed;',t))
  totals[group]=totals.get(group,0)+passed
  if group.endswith('windows'):
   cases=re.findall(r'(?:PASS|LEAK)\s+\[[^\]]+\]\s+\(\s*\d+/\s*\d+\) ([^\r\n]+)',t)
   names.setdefault(group,[]).extend(cases)
 out.append({'run':r,'passed':totals,'windows_test_names':{k:sorted(v) for k,v in names.items()}})
if out:
 for r in out[1:]:
  assert r['passed']==out[0]['passed'],(r['run'],r['passed'],out[0]['passed'])
  assert r['windows_test_names']==out[0]['windows_test_names'],r['run']
published=[{**r,'windows_test_names':{k:{'count':len(v),'sha256':hashlib.sha256(json.dumps(v).encode()).hexdigest()} for k,v in r['windows_test_names'].items()}} for r in out]
(P/'coverage-audit.json').write_text(json.dumps(published,indent=2)+'\n')
for r in out:print(r['run']['id'],r['passed'])
