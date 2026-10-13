import hashlib, json, os, pathlib, stat
home=pathlib.Path.home()
roots={'cargo':home/'.cargo','target':pathlib.Path('target')}
rows=[]
for label,root in roots.items():
 for path in sorted(root.rglob('*')):
  info=path.lstat()
  if not stat.S_ISREG(info.st_mode):continue
  rel=path.relative_to(root)
  if label=='cargo' and rel.parts[0] not in ['bin','registry','git','.crates.toml','.crates2.json']:continue
  h=hashlib.sha256()
  with path.open('rb') as f:
   while True:
    chunk=f.read(1024*1024)
    if not chunk:break
    h.update(chunk)
  rows.append({'path':str(pathlib.PurePosixPath(label)/rel),'bytes':info.st_size,'sha256':h.hexdigest()})
output=pathlib.Path(os.environ['RUNNER_TEMP'])/'cache-inventory.json'
output.write_text(json.dumps({'key':os.environ['CACHE_KEY'],'files':rows}))
print(json.dumps({'files':len(rows),'uncompressed_bytes':sum(x['bytes'] for x in rows)}))
