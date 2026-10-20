import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('vite-plus/package.json'));
const project = require('./package.json');
assert.equal(project.overrides, undefined);
assert.equal(project.devDependencies.vite, 'npm:@voidzero-dev/vite-plus-core@latest');
// npm may satisfy a tagged alias with an upstream Vite peer. Check the
// command against the installed package instead of depending on that choice.
const projectVite = require('vite/package.json');
assert.equal(cliRequire('vite/package.json').name, '@voidzero-dev/vite-plus-core');
const dev = spawnSync('vp', ['dev'], { encoding: 'utf8', timeout: 30_000 });
assert.ifError(dev.error);
const output = dev.stdout + dev.stderr;
if (projectVite.name === 'vite') {
  assert.notEqual(require.resolve('vite/package.json'), cliRequire.resolve('vite/package.json'));
  assert.equal(dev.status, 1, output);
  assert.match(output, /Expected @voidzero-dev\/vite-plus-core@/);
  assert.match(output, /but found vite@/);
  assert.match(output, /Run `vp migrate` to align the Vite alias, then run `vp install`\./);
} else {
  assert.equal(projectVite.name, '@voidzero-dev/vite-plus-core');
  assert.equal(projectVite.version, cliRequire('vite-plus/package.json').version);
  assert.equal(dev.status, 0, output);
  assert.match(output, /SSR environment identity and HTTP response passed/);
}
console.log('vp dev validates the installed package behind the tagged npm alias');

const pack = spawnSync('vp', ['pack', 'entry.js'], { encoding: 'utf8', timeout: 30_000 });
assert.ifError(pack.error);
assert.equal(pack.status, 0, pack.stdout + pack.stderr);
console.log('vp pack uses its private runtime with the tagged npm alias');
