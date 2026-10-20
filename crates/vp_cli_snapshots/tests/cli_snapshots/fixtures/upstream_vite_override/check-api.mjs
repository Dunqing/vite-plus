import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as vite from 'vite';
import { ModuleRunner } from 'vite/module-runner';
import * as vp from 'vite-plus';
import { ModuleRunner as VpModuleRunner } from 'vite-plus/module-runner';
import { build as pack } from 'vite-plus/pack';

const require = createRequire(import.meta.url);
const cliRequire = createRequire(require.resolve('vite-plus/package.json'));
const vitestRequire = createRequire(cliRequire.resolve('vitest/package.json'));
const cliPkg = cliRequire('vite-plus/package.json');
assert.equal(cliPkg.dependencies['@voidzero-dev/vite-plus-core'], undefined);
assert.throws(() => cliRequire.resolve('vite/pack'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
assert.equal(pack, (await import(pathToFileURL(cliRequire.resolve('#pack')).href)).build);
assert.equal(vite.version, '8.3.4');
for (const name of [
  'createServer',
  'build',
  'resolveConfig',
  'DevEnvironment',
  'isRunnableDevEnvironment',
  'isFetchableDevEnvironment',
]) {
  assert.equal(vite[name], vp[name], name);
  assert.equal(require('vite-plus')[name], vite[name], name);
}
assert.equal(ModuleRunner, VpModuleRunner);
assert.equal(cliRequire.resolve('vite'), require.resolve('vite'));
assert.equal(vitestRequire.resolve('vite'), require.resolve('vite'));
if (process.env.LOCAL_VITE === '1') {
  assert.equal(vp.ecosystemCiMarker, 'local-vite');
}
console.log('API exports and bundled Vitest use upstream Vite; pack uses its private bundled runtime');
