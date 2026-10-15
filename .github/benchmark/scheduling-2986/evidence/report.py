from pathlib import Path
import json
P=Path(__file__).parent
rows=json.loads((P/'analysis.json').read_text())
def fmt(x):
 x=round(x);return f'{x//60}m{x%60:02d}s' if x>=60 else f'{x}s'
def delta(a,b):
 if a==b:return '⚪ unchanged'
 return f"{'🟢 ↓' if b<a else '🔴 ↑'}{fmt(abs(b-a))} ({abs(b-a)/a*100:.1f}%)"
def row(cache,variant):
 return next(r for r in rows if r['cache']==cache and r['variant']==variant and (cache=='cold' or r['sample']==1))
pairs=[('Cold',row('cold','before'),row('cold','after')),('Warm',row('warm','before'),row('warm','after'))]
lines=['| Cache | Main | PR | Change |','| --- | ---: | ---: | ---: |']
for label,a,b in pairs:
 av,bv=a['elapsed_seconds'],b['elapsed_seconds']
 lines.append(f"| {label} | [{fmt(av)}]({a['url']}) | [{fmt(bv)}]({b['url']}) | {delta(av,bv)} |")
lines+=['','| Warm job or phase | Main | PR | Change |','| --- | ---: | ---: | ---: |']
a,b=pairs[1][1:]
for label,key_a,key_b in [
 ('Linux CLI archive','Build CLI test binaries (x86_64-unknown-linux-gnu)','Build CLI test binaries (x86_64-unknown-linux-gnu)'),
 ('macOS CLI archive','Build CLI test binaries (aarch64-apple-darwin)','Build CLI test binaries (aarch64-apple-darwin)'),
 ('Windows unit archive','Build Windows tests','Build Windows tests'),
 ('Windows snapshot archive','Build Windows tests','Build Windows snapshot tests')]:
 av,bv=a['job_seconds'][key_a],b['job_seconds'][key_b]
 lines.append(f'| {label} | {fmt(av)} | {fmt(bv)} | {delta(av,bv)} |')
av,bv=a['install_elapsed_seconds'],b['install_elapsed_seconds'];lines.append(f'| Six install repositories | {fmt(av)} | {fmt(bv)} | {delta(av,bv)} |')
lines+=['','Main builds both Windows archives in one job; its duration appears in both archive rows. Job durations exclude queue time. The install phase includes delays between its jobs.','','| Cache | Runner time on main | Runner time on PR | Change |','| --- | ---: | ---: | ---: |']
for label,a,b in pairs:
 av,bv=a['runner_seconds'],b['runner_seconds'];lines.append(f'| {label} | {fmt(av)} | {fmt(bv)} | {delta(av,bv)} |')
(P/'tables.md').write_text('\n'.join(lines)+'\n');print('\n'.join(lines))
