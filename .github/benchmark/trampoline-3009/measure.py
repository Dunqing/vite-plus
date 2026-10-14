from pathlib import Path
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import time

root = Path.cwd().resolve()
target = root / 'target'
out = Path(os.environ['RUNNER_TEMP']) / 'trampoline-3009-results'
out.mkdir(exist_ok=True)
metadata = json.loads((root / '.github/benchmark/trampoline-3009/metadata.json').read_text())
mode = sys.argv[1]
variant = os.environ.get('BENCH_VARIANT', 'both')


def inventory(path):
    files = [p for p in path.rglob('*') if p.is_file()] if path.exists() else []
    return {'files': len(files), 'bytes': sum(p.stat().st_size for p in files),
            'rlibs': sum(p.suffix == '.rlib' for p in files)}


def remove_target():
    assert target == root / 'target' and target.parent == root
    if target.exists():
        shutil.rmtree(target)


def run(selected, label, prime=False):
    env = dict(os.environ)
    prime_target = Path(os.environ['RUNNER_TEMP']) / 'trampoline-3009-prime-target'
    if prime:
        env['CARGO_TARGET_DIR'] = str(prime_target)
    start = time.perf_counter()
    with (out / f'{label}.log').open('w') as log:
        process = subprocess.run(['bash', '-c', metadata['commands'][selected]],
                                 env=env, stdout=log, stderr=subprocess.STDOUT)
    seconds = time.perf_counter() - start
    log = (out / f'{label}.log').read_text()
    if process.returncode:
        print(log[-12000:])
        raise RuntimeError(f'{label} failed: {process.returncode}')
    names = sorted(re.findall(r'^test (.+) \.\.\. ok$', log, re.M))
    assert names, 'No successful tests found'
    result = {'variant': selected, 'seconds': seconds,
              'compiling': re.findall(r'^\s*Compiling (\S+)', log, re.M),
              'finished': re.findall(r'^\s*Finished .*$', log, re.M),
              'test_results': re.findall(r'^test result:.*$', log, re.M),
              'test_names': names, 'target': inventory(prime_target if prime else target)}
    if prime:
        shutil.rmtree(prime_target)
    return result


if mode == 'initial':
    assert not target.exists(), 'Unexpected pre-existing target directory'
    paths = ['Cargo.toml', 'Cargo.lock', 'rust-toolchain.toml', '.cargo/config.toml',
             'crates/vp_trampoline/Cargo.toml', 'crates/vp_trampoline/.cargo/config.toml']
    paths += [str(p.relative_to(root)) for p in sorted((root / 'crates/vp_trampoline/src').rglob('*.rs'))]
    data = {**metadata, 'machine': platform.uname()._asdict(),
            'cpu': subprocess.check_output(['sysctl', 'hw.model', 'hw.ncpu', 'hw.physicalcpu', 'hw.memsize'] if sys.platform == 'darwin' else ['lscpu'], text=True),
            'inputs': {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in paths}}
    (out / 'initial.json').write_text(json.dumps(data, indent=2) + '\n')
else:
    assert mode in ['cold', 'warm', 'musl']
    hit = os.environ.get('BENCH_CACHE_HIT', '')
    assert (hit == 'true') == (mode == 'warm'), f'Incorrect cache state: {hit}, {mode}'
    restored = inventory(target)
    if mode != 'warm':
        assert restored['files'] == 0, restored
    snapshot = Path(os.environ['RUNNER_TEMP']) / 'trampoline-3009-restored-target'
    if mode == 'warm' and target.exists():
        shutil.copytree(target, snapshot)
    # Give both variants identical downloaded standard-library sources.
    # The priming build uses a separate directory and is not measured.
    prime = run('before', 'source-prime', prime=True)
    samples = []
    for iteration in range(metadata['samples_per_condition']):
        order = [variant] if mode != 'musl' else (['before', 'after'] if iteration % 2 == 0 else ['after', 'before'])
        for selected in order:
            remove_target()
            if mode == 'warm' and snapshot.exists():
                shutil.copytree(snapshot, target)
            before = inventory(target)
            sample = run(selected, f'{selected}-{iteration + 1}')
            assert sample['test_names'] == prime['test_names']
            sample.update(iteration=iteration + 1, initial_target=before)
            samples.append(sample)
            print(json.dumps({k: sample[k] for k in ['variant', 'iteration', 'seconds', 'compiling']}), flush=True)
    data = {'mode': mode, 'variant': variant, 'cache_hit': hit, 'restored': restored,
            'rustc': subprocess.check_output(['rustc', '-vV'], text=True),
            'source_prime': prime, 'samples': samples}
    (out / 'measurements.json').write_text(json.dumps(data, indent=2) + '\n')
