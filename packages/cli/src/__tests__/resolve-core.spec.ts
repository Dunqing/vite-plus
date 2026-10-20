import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import cliPkg from '../../package.json' with { type: 'json' };
import { resolveVitePackage } from '../resolve-core.ts';

function writePackageJson(directory: string, manifest: Record<string, unknown>): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
}

function writeCore(
  directory: string,
  name = '@voidzero-dev/vite-plus-core',
  version = cliPkg.version,
): void {
  writePackageJson(directory, {
    name,
    version,
    exports: { '.': './index.js', './pack': './pack.js', './package.json': './package.json' },
  });
  writeFileSync(join(directory, 'index.js'), '');
  writeFileSync(join(directory, 'pack.js'), '');
}

function writeCli(directory: string, version = cliPkg.version): void {
  writePackageJson(directory, {
    name: 'vite-plus',
    version,
    exports: { './package.json': './package.json' },
  });
}

describe('core and Vite resolution', () => {
  let root: string;
  let project: string;
  let cliModule: string;
  let projectCore: string;
  let cliVite: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'vp-core-resolver-')));
    project = join(root, 'project');
    writePackageJson(project, {
      devDependencies: { vite: `npm:@voidzero-dev/vite-plus-core@${cliPkg.version}` },
    });
    cliModule = join(root, 'cli', 'dist', 'bin.js');
    cliVite = join(root, 'cli', 'node_modules', 'vite');
    projectCore = join(project, 'node_modules', 'vite');
    writeCli(join(root, 'cli'));
    writeCore(cliVite);
    writeCore(projectCore);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('supports a CLI installation without a project-level vite alias', () => {
    writePackageJson(project, { devDependencies: { 'vite-plus': cliPkg.version } });
    rmSync(projectCore, { recursive: true });
    expect(resolveVitePackage(project, cliModule, false)).toBe(join(cliVite, 'package.json'));
  });

  it('ignores an upstream Vite peer hoisted by npm in a CLI-only project', () => {
    writePackageJson(project, { devDependencies: { 'vite-plus': cliPkg.version } });
    writeCore(projectCore, 'vite', '8.2.2');
    expect(resolveVitePackage(project, cliModule, false)).toBe(join(cliVite, 'package.json'));
  });

  it.each(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'])(
    'validates an explicit Vite declaration in %s from a project subdirectory',
    (field) => {
      writePackageJson(project, { [field]: { vite: '^8.0.0' } });
      writeCore(projectCore, 'vite', '8.2.2');
      const subdirectory = join(project, 'src');
      mkdirSync(subdirectory);
      expect(() => resolveVitePackage(subdirectory, cliModule, false)).toThrow('found vite@8.2.2');
    },
  );

  it('keeps the same anchor as static exports when the project has a matching copy', () => {
    writeCore(projectCore);
    expect(resolveVitePackage(project, cliModule, false)).toBe(join(cliVite, 'package.json'));
  });

  it.each(['0.0.0', '0.0.0-commit.1234567'])(
    'uses the installed CLI manifest after repacking as %s',
    (version) => {
      writeCli(join(root, 'cli'), version);
      writeCore(cliVite, '@voidzero-dev/vite-plus-core', version);
      writeCore(projectCore, '@voidzero-dev/vite-plus-core', version);
      expect(resolveVitePackage(project, cliModule, false)).toBe(join(cliVite, 'package.json'));
    },
  );

  it.each(['project', 'cli alias'])(
    'still rejects a mismatched %s core after repacking the CLI',
    (location) => {
      writeCli(join(root, 'cli'), '0.0.0');
      writeCore(cliVite, '@voidzero-dev/vite-plus-core', '0.0.0');
      writeCore(location === 'project' ? projectCore : cliVite);
      expect(() => resolveVitePackage(project, cliModule, false)).toThrow(
        `Expected @voidzero-dev/vite-plus-core@0.0.0, but found @voidzero-dev/vite-plus-core@${cliPkg.version}`,
      );
    },
  );

  it('does not fall back to the project when the CLI dependency is missing', () => {
    writeCore(projectCore);
    rmSync(cliVite, { recursive: true });
    // pnpm injects NODE_PATH, which can supply an unrelated Vite package.
    // Check the missing dependency in a process without global search paths.
    execFileSync(process.execPath, [
      '--no-global-search-paths',
      '--input-type=module',
      '--eval',
      `import { strict as assert } from 'node:assert';
       import { resolveVitePackage } from ${JSON.stringify(new URL('../resolve-core.ts', import.meta.url).href)};
       assert.throws(
         () => resolveVitePackage(${JSON.stringify(project)}, ${JSON.stringify(cliModule)}, false),
         /Could not resolve the bundled Vite/,
       );`,
    ]);
  });

  it.each(['project', 'cli alias'])('rejects upstream Vite in the %s dependency', (location) => {
    writeCore(location === 'project' ? projectCore : cliVite, 'vite', '8.2.2');
    expect(() => resolveVitePackage(project, cliModule, false)).toThrow('found vite@8.2.2');
  });

  it.each(['project', 'cli alias'])('rejects a stale core in the %s dependency', (location) => {
    writeCore(
      location === 'project' ? projectCore : cliVite,
      '@voidzero-dev/vite-plus-core',
      '0.0.0-stale',
    );
    expect(() => resolveVitePackage(project, cliModule, false)).toThrow(
      'found @voidzero-dev/vite-plus-core@0.0.0-stale',
    );
  });

  it.each(['8.3.4', '9.0.0-dev'])(
    'allows shared upstream Vite %s only with the opt-in',
    (version) => {
      writeCore(cliVite, 'vite', version);
      rmSync(projectCore, { recursive: true });
      symlinkSync(cliVite, projectCore, 'junction');
      expect(() => resolveVitePackage(project, cliModule, false)).toThrow(`found vite@${version}`);
      expect(resolveVitePackage(project, cliModule, true)).toBe(join(cliVite, 'package.json'));
    },
  );

  it.each(['project', 'cli'])(
    'rejects an override applied only to the %s with the opt-in',
    (location) => {
      writeCore(location === 'project' ? projectCore : cliVite, 'vite', '8.3.4');
      expect(() => resolveVitePackage(project, cliModule, true)).toThrow(
        'requires the project and vite-plus to resolve the same Vite package',
      );
    },
  );

  it.each([
    ['vite', '8.3.4'],
    ['@voidzero-dev/vite-plus-core', cliPkg.version],
  ])('rejects separate copies of %s@%s with the opt-in', (name, version) => {
    writeCore(projectCore, name, version);
    writeCore(cliVite, name, version);
    expect(() => resolveVitePackage(project, cliModule, true)).toThrow(
      'requires the project and vite-plus to resolve the same Vite package',
    );
  });

  it('allows a shared matching core alias with the opt-in', () => {
    rmSync(projectCore, { recursive: true });
    symlinkSync(cliVite, projectCore, 'junction');
    expect(resolveVitePackage(project, cliModule, true)).toBe(join(cliVite, 'package.json'));
  });

  it.each(['other-package', '@voidzero-dev/vite-plus-core'])(
    'does not bypass checks for %s with the opt-in',
    (name) => {
      writeCore(projectCore, name, '0.0.0-stale');
      expect(() => resolveVitePackage(project, cliModule, true)).toThrow(
        `found ${name}@0.0.0-stale`,
      );
    },
  );

  it('does not use a hoisted Vite peer with the opt-in', () => {
    writePackageJson(project, { devDependencies: { 'vite-plus': cliPkg.version } });
    writeCore(projectCore, 'vite', '8.3.4');
    expect(() => resolveVitePackage(project, cliModule, true)).toThrow(
      'requires a declared project Vite dependency',
    );
  });

  it('does not fall back to bundled Vite when the opted-in project dependency is missing', () => {
    rmSync(projectCore, { recursive: true });
    execFileSync(process.execPath, [
      '--no-global-search-paths',
      '--input-type=module',
      '--eval',
      `import { strict as assert } from 'node:assert';
       import { resolveVitePackage } from ${JSON.stringify(new URL('../resolve-core.ts', import.meta.url).href)};
       assert.throws(
         () => resolveVitePackage(${JSON.stringify(project)}, ${JSON.stringify(cliModule)}, true),
         /Could not resolve the project Vite/,
       );`,
    ]);
  });
});
