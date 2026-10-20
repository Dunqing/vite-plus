import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('vite-plus/package.json'));
const manifest = cliRequire.resolve('@voidzero-dev/vite-plus-core/package.json');
const original = readFileSync(manifest, 'utf8');
try {
  writeFileSync(manifest, JSON.stringify({ ...JSON.parse(original), version: '0.0.0-stale' }));
  for (const command of ['pack', 'build']) {
    const local = process.argv[2] === 'local';
    const args = local
      ? [join(dirname(require.resolve('vite-plus/package.json')), 'bin/vp'), command]
      : [command];
    const result = spawnSync(local ? process.execPath : 'vp', args, {
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout + result.stderr, /found @voidzero-dev\/vite-plus-core@0.0.0-stale/);
  }
  console.log('Pack and Vite commands still reject a mismatched internal core');
} finally {
  writeFileSync(manifest, original);
}
