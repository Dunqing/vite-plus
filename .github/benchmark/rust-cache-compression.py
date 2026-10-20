import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time

out = Path(os.environ['RUNNER_TEMP']) / 'rust-cache-compression'
out.mkdir()
raw = out / 'cache.tar'
cargo = Path.home() / '.cargo'
tar = shutil.which('gtar') or shutil.which('tar')
paths = [str(cargo / name) for name in ['registry', 'git']] + [str(Path.cwd() / 'target')]
subprocess.run([tar, '--posix', '-cf', str(raw), '-P', *paths], check=True)
source_hash = hashlib.file_digest(raw.open('rb'), 'sha256').hexdigest()
data = {
    'name': os.environ['BENCH_NAME'],
    'cache_key': os.environ['BENCH_CACHE_KEY'],
    'cache_id': int(os.environ['BENCH_CACHE_ID']),
    'source_bytes': raw.stat().st_size,
    'source_sha256': source_hash,
    'paths': paths,
    'zstd': subprocess.check_output(['zstd', '--version'], text=True).strip(),
    'samples': [],
}
for level in [3, 9]:
    dest = out / f'cache-{level}.zst'
    env = dict(os.environ, ZSTD_CLEVEL=str(level))
    start = time.monotonic()
    with raw.open('rb') as source:
        subprocess.run(['zstdmt', '-q', '-f', '-o', str(dest)], stdin=source, env=env, check=True)
    compress = time.monotonic() - start
    start = time.monotonic()
    process = subprocess.Popen(['unzstd', '-c', str(dest)], stdout=subprocess.PIPE)
    restored_hash = hashlib.file_digest(process.stdout, 'sha256').hexdigest()
    assert process.wait() == 0
    assert source_hash == restored_hash
    data['samples'].append({
        'level': level, 'bytes': dest.stat().st_size,
        'compress_seconds': compress, 'decompress_and_hash_seconds': time.monotonic() - start,
    })
    print(json.dumps(data['samples'][-1]), flush=True)
    dest.unlink()
(out / 'results.json').write_text(json.dumps(data, indent=2) + '\n')
raw.unlink()
