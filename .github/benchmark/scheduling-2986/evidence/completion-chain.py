from pathlib import Path
import json
P=Path(__file__).parent
rows=json.loads((P/'analysis.json').read_text())
def fmt(x):
 x=int(x);return f'{x//60}m{x%60:02d}s'
lines=['This table follows the last completed dependency at each step back from `done`. It describes the observed completion path; it is not a prediction of CI time without queues. Gaps include runner allocation and scheduling after dependencies finish.','', '| Cache | Variant | Run | Elapsed | Job execution on path | Gaps on path | Last job before gate |','| --- | --- | --- | ---: | ---: | ---: | --- |']
for r in sorted(rows,key=lambda r:(r['cache'],r['sample'],r['variant'])):
 chain=r['completion_chain'];execution=sum(r['job_seconds'][k] for k in chain);gaps=sum(r['dependency_start_gaps'][k] for k in chain)
 assert execution+gaps==r['elapsed_seconds']
 lines.append(f"| {r['cache']} {r['sample']} | {r['variant']} | [{r['id']}]({r['url']}) | {fmt(r['elapsed_seconds'])} | {fmt(execution)} | {fmt(gaps)} | {chain[-2]} |")
lines+=['','The full job paths and timestamps are in `analysis.json`.']
(P/'completion-chain.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines))
