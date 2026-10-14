from pathlib import Path
import hashlib
import json
import os
import platform
import shutil
import statistics
import subprocess

ROOT = Path.cwd()
HERE = ROOT / '.github/benchmark/migration-2987'
META = json.loads((HERE / 'metadata.json').read_text())
OUT = Path(os.environ['RUNNER_TEMP']) / 'pr-2987'
WORK = OUT / 'fixture'
assert not WORK.exists()
env = {**os.environ, 'RAYON_NUM_THREADS': str(META['rayon_threads'])}
records = []
expected = {}
summary = {
    **META,
    'machine': platform.uname()._asdict(),
    'cpu': subprocess.check_output(['lscpu'], text=True),
    'rustc': subprocess.check_output(['rustc', '-vV'], text=True),
    'samples': records,
}

def digest(root):
    value = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        if path.is_symlink():
            data = ('symlink:' + os.readlink(path)).encode()
        elif path.is_file():
            data = path.read_bytes()
        else:
            continue
        value.update(path.relative_to(root).as_posix().encode() + b'\0')
        value.update(hashlib.sha256(data).digest())
    return value.hexdigest()

for project, config in META['projects'].items():
    checkout = ROOT / '.benchmark-fixtures' / project
    commit = subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip()
    assert commit == config['hash'], (project, commit)
    archive = OUT / f'{project}.tar'
    with archive.open('wb') as file:
        subprocess.run(['git', '-C', str(checkout), 'archive', 'HEAD'], stdout=file, check=True)
    rounds = [('warmup', 0, ['before', 'after'])]
    rounds += [('timed', sample + 1, ['before', 'after'] if sample % 2 == 0 else ['after', 'before'])
               for sample in range(META['samples'])]
    rounds += [('diagnostic', 0, ['before', 'after'])]
    for kind, sample, variants in rounds:
        for variant in variants:
            if WORK.exists():
                shutil.rmtree(WORK)
            WORK.mkdir()
            subprocess.run(['tar', '-xf', str(archive), '-C', str(WORK)], check=True)
            input_hash = digest(WORK)
            assert expected.setdefault((project, 'input'), input_hash) == input_hash
            binary = OUT / (variant + ('-diagnostic' if kind == 'diagnostic' else ''))
            for phase in ['first_pass', 'already_migrated']:
                result = json.loads(subprocess.check_output([str(binary), str(WORK)], env=env, text=True))
                output_hash = digest(WORK)
                signature = (result['modified'], result['unchanged'], result['warnings'], output_hash)
                assert expected.setdefault((project, phase), signature) == signature, (project, phase, variant)
                record = {'project': project, 'kind': kind, 'sample': sample, 'variant': variant,
                          'phase': phase, 'input_hash': input_hash, 'output_hash': output_hash, **result}
                records.append(record)
                (OUT / 'results.json').write_text(json.dumps(summary, indent=2) + '\n')
                print(json.dumps({key: value for key, value in record.items() if key not in ['modified', 'warnings']}
                                 | {'modified_count': len(result['modified'])}), flush=True)

lines = ['Only PR #2987 is applied to the baseline. Both binaries use the release profile.',
         '', '| Project | Phase | Main median | PR median | Change |', '| --- | --- | ---: | ---: | ---: |']
for project in META['projects']:
    for phase in ['first_pass', 'already_migrated']:
        medians = [statistics.median(r['seconds'] for r in records
                   if r['project'] == project and r['phase'] == phase and r['kind'] == 'timed' and r['variant'] == variant)
                   for variant in ['before', 'after']]
        before, after = medians
        lines.append(f'| {project} | {phase} | {before:.3f}s | {after:.3f}s | {(after / before - 1) * 100:+.1f}% |')
(OUT / 'summary.md').write_text('\n'.join(lines) + '\n')
with Path(os.environ['GITHUB_STEP_SUMMARY']).open('a') as file:
    file.write((OUT / 'summary.md').read_text())
print('All outputs and modified-file lists match between variants.', flush=True)
