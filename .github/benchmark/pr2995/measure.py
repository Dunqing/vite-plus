from pathlib import Path
import json
import os
import platform
import subprocess
import sys
import time

OUT = Path(os.environ['RUNNER_TEMP']) / 'pr-2995'
OUT.mkdir(exist_ok=True)
REPORT = OUT / 'measurements.json'

def save(data):
    REPORT.write_text(json.dumps(data, indent=2) + '\n')

def command(*args):
    try:
        result = subprocess.run(args, text=True, capture_output=True)
    except FileNotFoundError:
        return {'exit_code': 127, 'stdout': '', 'stderr': f'{args[0]} is not installed yet'}
    return {'exit_code': result.returncode, 'stdout': result.stdout, 'stderr': result.stderr}

mode = sys.argv[1]
if mode == 'init':
    data = json.loads(Path('.github/benchmark/pr2995/metadata.json').read_text())
    data.update({
        'variant': os.environ['SDK_VARIANT'], 'cache_state': os.environ['SDK_CACHE_STATE'],
        'sample': os.environ['SDK_SAMPLE'], 'run_id': os.environ['GITHUB_RUN_ID'],
        'runner': platform.uname()._asdict(), 'cpu': command('lscpu'),
        'initial_clang': command('clang-cl', '--version'),
        'clang22_preinstalled': Path('/usr/lib/llvm-22/bin/clang').exists(),
        'image': {key: os.environ.get(key) for key in ['ImageOS', 'ImageVersion']},
        'phases': {},
    })
    sdk = Path.home() / '.cache/cargo-xwin'
    assert not sdk.exists() or not any(sdk.iterdir()), 'Runner has an existing SDK before controlled cache restore'
    assert not Path('target').exists(), 'Runner has an existing Cargo target directory'
    save(data)
    print(json.dumps({key: data[key] for key in ['base','head','variant','cache_state','sample','clang22_preinstalled']}))
else:
    data = json.loads(REPORT.read_text())
    if mode == 'sdk-start':
        data['cargo_xwin'] = command('cargo', 'xwin', '--version')
        data['rustc'] = command('rustc', '-vV')
        data['sdk_started'] = time.monotonic()
    elif mode == 'run':
        label, args = sys.argv[2], sys.argv[3:]
        started = time.monotonic()
        with (OUT / (label + '.log')).open('w') as log:
            result = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in result.stdout:
                print(line, end='', flush=True)
                log.write(line)
            code = result.wait()
        data['phases'][label] = {'seconds': time.monotonic() - started, 'exit_code': code, 'command': args}
        save(data)
        print('MEASURED', label, json.dumps(data['phases'][label]), flush=True)
        sys.exit(code)
    elif mode == 'sdk-end':
        data['phases']['sdk_ready'] = {'seconds': time.monotonic() - data.pop('sdk_started')}
        sdk = Path.home() / '.cache/cargo-xwin'
        assert (sdk / 'xwin/DONE').exists(), 'SDK initialization marker is absent'
        data['sdk_disk_bytes'] = int(subprocess.check_output(['du', '-sb', str(sdk)], text=True).split()[0])
        data['sdk_cache_bytes'] = sum(int(subprocess.check_output(['du', '-sb', str(Path(path).expanduser())], text=True).split()[0])
                                     for path in data['sdk_cache_paths'][data['variant']])
        data['sdk_files'] = sum(path.is_file() and not path.is_symlink() for path in sdk.rglob('*'))
        data['selected_clang'] = command('clang-cl', '--version')
        print('SDK_READY', json.dumps({key: data[key] for key in ['phases','sdk_disk_bytes','sdk_files','selected_clang']}))
    elif mode == 'finish':
        assert all(data['phases'][label]['exit_code'] == 0 for label in ['sdk-resolve','napi','cli','trampoline'])
        data['native_phase_seconds'] = sum(data['phases'][label]['seconds'] for label in ['napi','cli','trampoline'])
        data['sdk_plus_native_seconds'] = data['phases']['sdk_ready']['seconds'] + data['native_phase_seconds']
        print(json.dumps(data, indent=2))
    else:
        raise ValueError(mode)
    save(data)
