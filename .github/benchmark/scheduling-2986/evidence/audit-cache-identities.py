from pathlib import Path
import json
P=Path(__file__).parent
state=json.loads((P/'state.json').read_text())
shared=json.loads((P/'shared-cache-identities.json').read_text())
reports=[]
for r in state['runs']:
 if r['cache']!='warm' or r.get('conclusion')!='success' or r.get('excluded_from_measurement'):continue
 manifest=r.get('cache_identity_manifest',f"required-cache-identities-{r['variant']}.json")
 required=json.loads((P/manifest).read_text())
 before=r.get('cache_before_inventory',f"before-{r['variant']}-warm-{r['sample']}-caches.json")
 for filename in [before,f"{r['id']}-caches-after.json"]:
  d=json.loads((P/filename).read_text());entries={c['id']:c for c in d['actions_caches']}
  missing=[c['key'] for c in required if c['id'] not in entries]
  changed=[c['key'] for c in required if c['id'] in entries and entries[c['id']]['version']!=c['version']]
  shared_bad=[c['key'] for c in shared if c['id'] not in entries or entries[c['id']]['version']!=c['version']]
  reports.append({'run':r['id'],'variant':r['variant'],'sample':r['sample'],'file':filename,'manifest':manifest,'required_count':len(required),'missing':missing,'changed_versions':changed,'shared_identity_failures':shared_bad,'observed_required_entries':[entries[c['id']] for c in required if c['id'] in entries]})
  print(r['id'],filename,'required',len(required),'missing',len(missing),'changed',len(changed),'shared failures',len(shared_bad))
(P/'cache-identity-audit.json').write_text(json.dumps(reports,indent=2)+'\n')
assert all(not r['missing'] and not r['changed_versions'] and not r['shared_identity_failures'] for r in reports)
