import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
// Reuse the installed upstream package to test a local build without a second
// download. Change its public entries so resolution cannot pass by accident.
cpSync(dirname(require.resolve('vite/package.json')), 'local-vite', { recursive: true });
const pkg = JSON.parse(readFileSync('local-vite/package.json', 'utf8'));
const entry = pkg.exports['.'];
pkg.exports['.'] = './ecosystem-api.mjs';
pkg.bin = { vite: './ecosystem-cli.mjs' };
pkg.files.push('ecosystem-api.mjs', 'ecosystem-cli.mjs');
writeFileSync('local-vite/package.json', JSON.stringify(pkg));
writeFileSync(
  'local-vite/ecosystem-api.mjs',
  `export * from ${JSON.stringify(entry)};
import { resolveConfig as upstreamResolveConfig } from ${JSON.stringify(entry)};
export const ecosystemCiMarker = 'local-vite';
export function resolveConfig(...args) {
  if (process.env.EXPECT_INTERNAL_CONFIG === '1') {
    throw new Error('Pack must load configuration with its internal core');
  }
  return upstreamResolveConfig(...args);
}
`,
);
writeFileSync(
  'local-vite/ecosystem-cli.mjs',
  `console.log('Local upstream Vite CLI entry');
await import('./bin/vite.js');
`,
);
const project = JSON.parse(readFileSync('package.json', 'utf8'));
project.devDependencies.vite = 'file:./local-vite';
writeFileSync('package.json', JSON.stringify(project));
writeFileSync(
  'pnpm-workspace.yaml',
  'minimumReleaseAge: 0\noverrides:\n  vite: file:./local-vite\n',
);
