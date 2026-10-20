import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as vite from 'vite';
import * as vp from 'vite-plus';
import { build as pack } from 'vite-plus/pack';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('vite-plus/package.json'));
const vitestRequire = createRequire(cliRequire.resolve('vitest/package.json'));
const core = cliRequire('@voidzero-dev/vite-plus-core/package.json');
assert.equal(core.version, cliRequire('vite-plus/package.json').version);
assert.equal(pack, cliRequire('@voidzero-dev/vite-plus-core/pack').build);
assert.equal(vite.version, '8.3.4');
for (const name of ['createServer', 'build', 'resolveConfig', 'DevEnvironment']) {
  assert.equal(vite[name], vp[name], name);
  assert.equal(require('vite-plus')[name], vite[name], name);
}
assert.equal(cliRequire.resolve('vite'), require.resolve('vite'));
assert.equal(vitestRequire.resolve('vite'), require.resolve('vite'));
if (process.env.LOCAL_VITE === '1') {
  assert.equal(vp.ecosystemCiMarker, 'local-vite');
}
console.log('API exports and bundled Vitest use upstream Vite; pack uses the matching internal core');
