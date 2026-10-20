import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const cliRoot = dirname(require.resolve('vite-plus/package.json'));
const upstream = dirname(require.resolve('vite/package.json'));
// Also cover the default strict behavior with real upstream Vite installed.
for (const command of ['dev', 'build', 'preview']) {
  const local = process.argv[2] === 'local';
  const args = local ? [join(cliRoot, 'bin/vp'), command] : [command];
  const result = spawnSync(local ? process.execPath : 'vp', args, {
    encoding: 'utf8', timeout: 30_000,
    env: { ...process.env, VP_USE_PROJECT_VITE: '0' },
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /but found vite@8\.3\.4/);
}
console.log('Upstream Vite rejected without the opt-in before dev/build/preview');

const cliModules = join(cliRoot, 'node_modules');
const cliVite = join(cliModules, 'vite');
const temporary = mkdtempSync(join(cliRoot, '.vite-identity-'));
const original = join(temporary, 'original-vite');
mkdirSync(cliModules, { recursive: true });
const hadVite = existsSync(cliVite);
if (hadVite) {
  renameSync(cliVite, original);
}

function checkRejected() {
  for (const command of ['dev', 'build', 'preview']) {
    const local = process.argv[2] === 'local';
    const args = local ? [join(cliRoot, 'bin/vp'), command] : [command];
    const result = spawnSync(local ? process.execPath : 'vp', args, {
      encoding: 'utf8',
      timeout: 30_000,
    });
    assert.ifError(result.error);
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /requires the project and vite-plus to resolve the same Vite package/);
    assert.match(output, /Apply the same override to all `vite` dependencies/);
  }
}

try {
  // A CLI alias left on core must fail before its runtime is loaded.
  mkdirSync(cliVite);
  writeFileSync(join(cliVite, 'package.json'), JSON.stringify({
    name: '@voidzero-dev/vite-plus-core',
    version: require('vite-plus/package.json').version,
    exports: { './package.json': './package.json' },
  }));
  checkRejected();
  console.log('Partial Vite override rejected before dev/build/preview');
  rmSync(cliVite, { recursive: true });

  // A second physical copy has the same version and exports but different
  // constructor identities. Version checks alone must not accept it.
  cpSync(upstream, cliVite, { recursive: true });
  checkRejected();
  console.log('Separate Vite copies with the same version rejected before dev/build/preview');
} finally {
  rmSync(cliVite, { recursive: true, force: true });
  if (hadVite) {
    renameSync(original, cliVite);
  }
  rmSync(temporary, { recursive: true, force: true });
}
