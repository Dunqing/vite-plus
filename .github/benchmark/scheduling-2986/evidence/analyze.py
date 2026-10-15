import json,datetime,re,yaml,subprocess
from pathlib import Path
P=Path(__file__).parent
def ts(v):return datetime.datetime.fromisoformat(v.replace('Z','+00:00')).timestamp()
def queue_details(js,variant,start):
 doc=yaml.safe_load(subprocess.check_output(['git','show',state['benchmark_head']+':.github/workflows/benchmark-'+variant+'-ci.yml'],text=True))['jobs']
 def match(name):
  candidates=[]
  for k,j in doc.items():
   prefix=j.get('name',k).split('${{',1)[0]
   if name.startswith(prefix):candidates.append((len(prefix),k))
  return max(candidates)[1]
 ids={k:match(k) for k in js}
 gaps={};parents={}
 for k,j in js.items():
  n=doc[ids[k]].get('needs',[]);n=[n] if isinstance(n,str) else n
  deps=[v for v in js if ids[v] in n]
  parent=max(deps,key=lambda v:ts(js[v]['completedAt'])) if deps else None
  ready=ts(js[parent]['completedAt']) if parent else start
  gaps[k]=ts(j['startedAt'])-ready;parents[k]=parent
 chain=[];k='done'
 while k:
  chain.append(k);k=parents[k]
 return {'dependency_start_gaps':gaps,'completion_chain':list(reversed(chain))}
state=json.loads((P/'state.json').read_text())
results=[]
for r in state['runs']:
 if r['cache']=='prime' or r.get('excluded_from_measurement'):continue
 p=P/f"{r['id']}.json"
 if not p.exists():continue
 d=json.loads(p.read_text())
 if d['status']!='completed' or d['conclusion']!='success':continue
 assert d['headSha']==state['benchmark_head'],r
 js={j['name'].split(' / ',1)[-1]:j for j in d['jobs'] if j['conclusion']!='skipped'}
 assert all(j['conclusion']=='success' for j in js.values()),r
 start=ts(js['detect-changes']['startedAt'])
 durations={k:ts(j['completedAt'])-ts(j['startedAt']) for k,j in js.items()}
 normal={k:j for k,j in js.items() if not k.startswith('Local CLI `vp install`') and k!='done'}
 last=max(normal,key=lambda k:ts(normal[k]['completedAt']))
 install={k:j for k,j in js.items() if k.startswith('Local CLI `vp install`')}
 assert len(install)==(1 if r['variant']=='before' else 6)
 results.append({**r,'url':d['url'],'head':d['headSha'],'elapsed_seconds':ts(js['done']['completedAt'])-start,
  'default_jobs_complete_seconds':ts(normal[last]['completedAt'])-start,'last_default_job':last,
  'install_elapsed_seconds':max(ts(j['completedAt']) for j in install.values())-min(ts(j['startedAt']) for j in install.values()),
  'install_finish_seconds':max(ts(j['completedAt']) for j in install.values())-start,
  'runner_seconds':sum(durations.values()),'job_seconds':durations,
  'starts':{k:ts(j['startedAt'])-start for k,j in js.items()},'finishes':{k:ts(j['completedAt'])-start for k,j in js.items()},
  **queue_details(js,r['variant'],start),
  'steps':{k:{s['name']:ts(s['completedAt'])-ts(s['startedAt']) for s in j['steps'] if s['conclusion']=='success'} for k,j in js.items()}})
for r in results:
 assert all(v>=0 for v in r['dependency_start_gaps'].values()),r['id']
 assert sum(r['job_seconds'][k]+r['dependency_start_gaps'][k] for k in r['completion_chain'])==r['elapsed_seconds'],r['id']
(P/'analysis.json').write_text(json.dumps(results,indent=2)+'\n')
for r in results:print(r['id'],r['variant'],r['cache'],r['sample'],'elapsed',r['elapsed_seconds'],'default',r['default_jobs_complete_seconds'],'install',r['install_elapsed_seconds'],'runner',r['runner_seconds'])
