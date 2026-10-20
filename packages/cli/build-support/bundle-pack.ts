import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';

import { format } from 'oxfmt';

import { rewriteModuleSpecifiers } from '../../core/build-support/rewrite-module-specifiers.ts';
import corePkg from '../../core/package.json' with { type: 'json' };

/**
 * Ship pack independently of the replaceable `vite` alias. Reuse the core
 * build's branded tsdown, extensions, Rolldown, and declarations, but copy no
 * Vite code. Release Rolldown uses the CLI's existing native platform packages;
 * development builds carry the local Rolldown binding, as core does.
 */
export async function bundlePack(projectDir: string): Promise<void> {
  const source = join(projectDir, '../core/dist');
  const destination = join(projectDir, 'dist/pack-runtime');
  await mkdir(destination, { recursive: true });
  for (const entry of ['tsdown', 'rolldown', 'pluginutils', 'esm-shims.js']) {
    await cp(join(source, entry), join(destination, entry), { recursive: true });
  }

  const exports: Record<string, string | { types?: string; default?: string } | null> =
    corePkg.exports;
  for (const file of await readdir(destination, { recursive: true })) {
    if (!/\.(?:[cm]?js|[cm]?ts)$/.test(file)) {
      continue;
    }
    const filename = join(destination, file);
    const content = await readFile(filename, 'utf8');
    const rewritten = rewriteModuleSpecifiers(content, filename, {
      rules: [
        {
          from: '@voidzero-dev/vite-plus-core',
          to(specifier) {
            const subpath = `.${specifier.slice('@voidzero-dev/vite-plus-core'.length)}`;
            const entry = exports[subpath];
            const target =
              entry && typeof entry === 'object'
                ? /\.d\.[cm]?ts$/.test(file)
                  ? entry.types
                  : entry.default
                : undefined;
            if (!target || !/^\.\/dist\/(?:rolldown|pluginutils)\//.test(target)) {
              throw new Error(`Pack must not depend on core at runtime: ${specifier} in ${file}`);
            }
            const path = relative(
              dirname(filename),
              join(destination, target.slice('./dist/'.length)),
            ).replaceAll('\\', '/');
            return path.startsWith('.') ? path : `./${path}`;
          },
        },
      ],
    });
    if (rewritten.includes('@voidzero-dev/vite-plus-core')) {
      throw new Error(`Unresolved core reference in private pack runtime: ${file}`);
    }
    await writeFile(filename, rewritten);
  }

  await writeFile(
    join(destination, 'version.js'),
    `export const tsdownVersion = ${JSON.stringify(corePkg.bundledVersions.tsdown)};\n`,
  );
  await writeFile(
    join(destination, 'version.d.ts'),
    'export declare const tsdownVersion: string;\n',
  );

  // These peers are resolved from the pack bundle at runtime. Keep the
  // declarations in sync with the same tsdown and DTS plugin that core bundles.
  const coreRequire = createRequire(join(projectDir, '../core/package.json'));
  const tsdownPath = coreRequire.resolve('tsdown/package.json');
  const tsdownPkg = JSON.parse(await readFile(tsdownPath, 'utf8'));
  const dtsPkg = createRequire(tsdownPath)('rolldown-plugin-dts/package.json');
  const manifestPath = join(projectDir, 'package.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const bundled = new Set(['rolldown', '@tsdown/css', '@tsdown/exe']);
  for (const field of ['peerDependencies', 'peerDependenciesMeta']) {
    for (const [name, value] of Object.entries({ ...dtsPkg[field], ...tsdownPkg[field] })) {
      if (!bundled.has(name)) {
        manifest[field][name] = value;
      }
    }
  }
  const { code, errors } = await format(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {
    sortPackageJson: true,
  });
  if (errors.length > 0) {
    throw new Error(`Could not format pack dependencies: ${JSON.stringify(errors)}`);
  }
  await writeFile(manifestPath, code);
}
