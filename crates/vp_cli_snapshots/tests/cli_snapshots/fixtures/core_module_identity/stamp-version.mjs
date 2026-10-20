import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cliManifest = require.resolve('vite-plus/package.json');
const cliRequire = createRequire(cliManifest);
for (const manifest of new Set([
  cliManifest,
  require.resolve('vite/package.json'),
  cliRequire.resolve('vite/package.json'),
  cliRequire.resolve('@voidzero-dev/vite-plus-core/package.json'),
])) {
  const pkg = JSON.parse(readFileSync(manifest, 'utf8'));
  pkg.version = '0.0.0';
  if (pkg.name === 'vite-plus') {
    pkg.dependencies.vite = 'npm:@voidzero-dev/vite-plus-core@0.0.0';
    pkg.dependencies['@voidzero-dev/vite-plus-core'] = '0.0.0';
  }
  writeFileSync(manifest, JSON.stringify(pkg));
}
