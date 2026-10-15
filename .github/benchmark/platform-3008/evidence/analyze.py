import json,re,datetime,statistics
from pathlib import Path
P=Path(__file__).resolve().parent
def ts(v):return datetime.datetime.fromisoformat(v.replace('Z','+00:00')).timestamp()
def canonical(name):
 n=name.split(' / ',1)[-1]
 if n.startswith('Build CLI test binaries'):return 'build-'+('macos' if 'apple' in n else 'linux')
 if n.startswith('CLI snapshot test'):
  os='windows' if 'Windows' in n else 'macos' if 'apple' in n else 'linux'
  return 'snapshot-'+os+'-'+re.search(r'shard (\d)',n)[1]
 if n.startswith('CLI E2E test (namespace'):
  return 'e2e-'+('windows' if 'windows' in n else 'macos' if 'mac-default' in n else 'linux')
 if n.startswith('Test (namespace'):return 'test-'+('macos' if 'mac-default' in n else 'linux')
 return {'Build Windows CLI binaries':'build-windows','Build Windows tests':'build-windows-tests','Test (Windows)':'test-windows','Test (Linux x64 musl)':'test-musl','CLI E2E test (Linux x64 musl)':'e2e-musl','Cert-less image E2E test':'certless','Lint':'lint','download-previous-rolldown-binaries':'rolldown'}.get(n,n)
def needs(k,variant,keys):
 if k=='detect-changes':return []
 if k=='done':return [x for x in keys if x!='done']
 if k in ['build-linux','build-macos','e2e-musl']:return ['rolldown' if variant=='before' else 'detect-changes']
 if k in ['e2e-linux','e2e-macos','e2e-windows']:
  return ['rolldown','build-linux','build-macos','build-windows'] if variant=='before' else ['build-'+k.split('-')[1]]
 if k.startswith('snapshot-windows'):return ['build-windows','build-windows-tests']+(['rolldown'] if variant=='before' else [])
 if k.startswith('snapshot-'):return ['build-linux','build-macos'] if variant=='before' else ['build-'+k.split('-')[1]]
 if k=='test-windows':return ['build-windows-tests']
 return ['detect-changes']
def replay(durations,variant):
 ends={};paths={}
 def finish(k):
  if k in ends:return ends[k]
  deps=needs(k,variant,durations)
  if deps:
   pred=max(deps,key=finish);end=finish(pred);path=paths[pred]
  else:end=0;path=[]
  ends[k]=end+durations[k];paths[k]=path+[k];return ends[k]
 finish('done');return {'seconds':ends['done'],'path':paths['done']}
results=[]
for r in json.loads((P/'state.json').read_text())['runs']:
 if r['cache']=='prime':continue
 d=json.loads((P/f"{r['id']}.json").read_text())
 if d['status']!='completed':continue
 js={canonical(j['name']):j for j in d['jobs'] if j['conclusion']!='skipped'}
 assert all(j['conclusion']=='success' for j in js.values()),r
 assert len(js)==(26 if r['variant']=='before' else 25),(len(js),list(js))
 start=ts(js['detect-changes']['startedAt'])
 durations={k:ts(j['completedAt'])-ts(j['startedAt']) for k,j in js.items()}
 transfers={k:sum(ts(s['completedAt'])-ts(s['startedAt']) for s in j['steps'] if s['name'].startswith('Run actions/download-artifact@') and s['conclusion']=='success') for k,j in js.items()}
 # Before has one unnamed download-artifact step per affected consumer. Windows also
 # has an unnamed snapshot-archive download; identify the Rolldown step by its order.
 removed={}
 for k,j in js.items():
  ss=j['steps'];idx=[i for i,s in enumerate(ss) if 'setup-ci-node' in s['name']]
  if idx and idx[0]+1<len(ss):
   s=ss[idx[0]+1]
   # E2E installs docs between setup-node and the redundant transfer.
   if s['name']=='Install docs dependencies':s=ss[idx[0]+2]
   if s['name'].startswith('Run actions/download-artifact@'):removed[k]=ts(s['completedAt'])-ts(s['startedAt'])
 row={**r,'url':d['url'],'head':d['headSha'],'elapsed_seconds':ts(js['done']['completedAt'])-start,'runner_seconds':sum(durations.values()),'job_seconds':durations,
 'starts':{k:ts(j['startedAt'])-start for k,j in js.items()},'finishes':{k:ts(j['completedAt'])-start for k,j in js.items()},'dependency_gaps':{k:ts(j['startedAt'])-max([ts(js[x]['completedAt']) for x in needs(k,r['variant'],js)] or [start]) for k,j in js.items()},'critical_path':replay(durations,r['variant'])}
 if r['variant']=='before':
  after={k:v-removed.get(k,0) for k,v in durations.items() if k!='rolldown'}
  row['removed_transfer_seconds']=removed
  row['same_durations_after']=replay(after,'after')
  row['estimated_schedule_saving_seconds']=row['critical_path']['seconds']-row['same_durations_after']['seconds']
 results.append(row)
for row in results:
 if row['variant']!='after':continue
 baseline=next((r for r in results if r['variant']=='before' and r['cache']==row['cache'] and r['sample']==row['sample']),None)
 if baseline is None:continue
 before={k:v+baseline['removed_transfer_seconds'].get(k,0) for k,v in row['job_seconds'].items()}
 before['rolldown']=baseline['job_seconds']['rolldown']
 row['same_durations_before']=replay(before,'before')
 row['estimated_schedule_saving_seconds']=row['same_durations_before']['seconds']-row['critical_path']['seconds']
(P/'analysis.json').write_text(json.dumps(results,indent=2)+'\n')
for r in results:print(r['id'],r['variant'],r['cache'],'elapsed',r['elapsed_seconds'],'runner',r['runner_seconds'],'critical path',r['critical_path'])
