from pathlib import Path
import hashlib
import json
import os
import platform
import re
import subprocess
import sys
import time

root = Path.cwd()
out = Path(os.environ['RUNNER_TEMP']) / 'cache-3000'
out.mkdir(exist_ok=True)
phase = sys.argv[1]

def inventory():
    target = root / 'target'
    return {
        'rlibs': len(list(target.rglob('*.rlib'))) if target.exists() else 0,
        'rmeta': len(list(target.rglob('*.rmeta'))) if target.exists() else 0,
        'fingerprint_files': len([p for p in target.rglob('*') if p.is_file() and '.fingerprint' in p.parts]) if target.exists() else 0,
        'target_bytes': int(subprocess.check_output(['du', '-sb', str(target)], text=True).split()[0]) if target.exists() else 0,
    }

if phase == 'start':
    assert not (root / 'target').exists(), 'Unexpected pre-existing build artifacts'
    data = json.loads((root / '.github/benchmark/cache-3000/metadata.json').read_text())
    data.update(variant=os.environ['BENCH_VARIANT'], cache_state=os.environ['BENCH_CACHE_STATE'],
                pair=os.environ['BENCH_PAIR'], machine=platform.uname()._asdict(),
                cpu=subprocess.check_output(['lscpu'], text=True),
                inputs={name: hashlib.sha256((root / name).read_bytes()).hexdigest()
                        for name in ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', '.cargo/config.toml', 'justfile']})
elif phase == 'restored':
    hit = os.environ['BENCH_CACHE_HIT']
    expected = os.environ['BENCH_CACHE_STATE'] == 'warm'
    assert (hit == 'true') == expected, f'Unexpected cache hit: {hit}, expected {expected}'
    data = {'cache_hit': hit, **inventory(), 'rustc': subprocess.check_output(['rustc', '-vV'], text=True)}
else:
    assert phase in ['check', 'test']
    command = ['cargo', 'check', '--all-targets', '--all-features'] if phase == 'check' else ['just', 'test']
    env = dict(os.environ)
    if phase == 'check':
        env['RUSTFLAGS'] = '-D warnings --cfg tokio_unstable'
    start = time.perf_counter()
    with (out / f'{phase}.log').open('w') as log:
        result = subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT)
    elapsed = time.perf_counter() - start
    log = (out / f'{phase}.log').read_text()
    data = {'seconds': elapsed, 'returncode': result.returncode,
            'compiling': len(re.findall(r'^\s*Compiling ', log, re.M)),
            'checking': len(re.findall(r'^\s*Checking ', log, re.M)),
            'test_results': re.findall(r'^test result:.*$', log, re.M),
            'finished': re.findall(r'^\s*Finished .*$', log, re.M), **inventory()}
    if result.returncode:
        print(log[-12000:])
(out / f'{phase}.json').write_text(json.dumps(data, indent=2) + '\n')
print(json.dumps(data, indent=2))
if phase in ['check', 'test']:
    sys.exit(data['returncode'])
