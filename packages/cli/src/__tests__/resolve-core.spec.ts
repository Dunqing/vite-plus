import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import cliPkg from '../../package.json' with { type: 'json' };
import { resolveCore, resolveVitePackage } from '../resolve-core.ts';

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
  let bundled: string;
  let projectCore: string;
  let cliVite: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'vp-core-resolver-')));
    project = join(root, 'project');
    writePackageJson(project, {
      devDependencies: { vite: `npm:@voidzero-dev/vite-plus-core@${cliPkg.version}` },
    });
    cliModule = join(root, 'cli', 'dist', 'bin.js');
    bundled = join(root, 'cli', 'node_modules', '@voidzero-dev/vite-plus-core');
    cliVite = join(root, 'cli', 'node_modules', 'vite');
    projectCore = join(project, 'node_modules', 'vite');
    writeCli(join(root, 'cli'));
    writeCore(bundled);
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
    expect(resolveCore('/pack', cliModule)).toBe(join(bundled, 'pack.js'));
  });

  it('ignores an upstream Vite peer hoisted by npm in a CLI-only project', () => {
    writePackageJson(project, { devDependencies: { 'vite-plus': cliPkg.version } });
    writeCore(projectCore, 'vite', '8.2.2');
    expect(resolveVitePackage(project, cliModule, false)).toBe(join(cliVite, 'package.json'));
    expect(resolveCore('/pack', cliModule)).toBe(join(bundled, 'pack.js'));
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
      writeCore(bundled, '@voidzero-dev/vite-plus-core', version);
      writeCore(cliVite, '@voidzero-dev/vite-plus-core', version);
      writeCore(projectCore, '@voidzero-dev/vite-plus-core', version);
      expect(resolveVitePackage(project, cliModule, false)).toBe(join(cliVite, 'package.json'));
      expect(resolveCore('/pack', cliModule)).toBe(join(bundled, 'pack.js'));
    },
  );

  it.each(['project', 'bundled', 'cli alias'])(
    'still rejects a mismatched %s core after repacking the CLI',
    (location) => {
      writeCli(join(root, 'cli'), '0.0.0');
      writeCore(bundled, '@voidzero-dev/vite-plus-core', '0.0.0');
      writeCore(cliVite, '@voidzero-dev/vite-plus-core', '0.0.0');
      writeCore(location === 'project' ? projectCore : location === 'bundled' ? bundled : cliVite);
      expect(() => resolveVitePackage(project, cliModule, false)).toThrow(
        `Expected @voidzero-dev/vite-plus-core@0.0.0, but found @voidzero-dev/vite-plus-core@${cliPkg.version}`,
      );
    },
  );

  it('does not fall back to the project when the CLI dependency is missing', () => {
    writeCore(projectCore);
    rmSync(bundled, { recursive: true });
    // pnpm injects NODE_PATH, which can supply an unrelated Vite package.
    // Check the missing dependency in a process without global search paths.
    execFileSync(process.execPath, [
      '--no-global-search-paths',
      '--input-type=module',
      '--eval',
      `import { strict as assert } from 'node:assert';
       import { resolveCore } from ${JSON.stringify(new URL('../resolve-core.ts', import.meta.url).href)};
       assert.throws(
         () => resolveCore('', ${JSON.stringify(cliModule)}),
         /Could not resolve the bundled Vite/,
       );`,
    ]);
  });

  it.each(['project', 'bundled', 'cli alias'])(
    'rejects upstream Vite in the %s dependency',
    (location) => {
      writeCore(
        location === 'project' ? projectCore : location === 'bundled' ? bundled : cliVite,
        'vite',
        '8.2.2',
      );
      expect(() => resolveVitePackage(project, cliModule, false)).toThrow('found vite@8.2.2');
    },
  );

  it.each(['project', 'bundled', 'cli alias'])(
    'rejects a stale core in the %s dependency',
    (location) => {
      writeCore(
        location === 'project' ? projectCore : location === 'bundled' ? bundled : cliVite,
        '@voidzero-dev/vite-plus-core',
        '0.0.0-stale',
      );
      expect(() => resolveVitePackage(project, cliModule, false)).toThrow(
        'found @voidzero-dev/vite-plus-core@0.0.0-stale',
      );
    },
  );

  it.each(['vite', '@voidzero-dev/vite-plus-core'])(
    'pack ignores a project override to %s',
    (name) => {
      writeCore(projectCore, name, '0.0.0-override');
      writeCore(cliVite, 'vite', '8.3.4');
      expect(resolveCore('/pack', cliModule)).toBe(join(bundled, 'pack.js'));
    },
  );

  it('selects upstream Vite only with the explicit opt-in', () => {
    writeCore(projectCore, 'vite', '8.3.4');
    writeCore(cliVite, 'vite', '8.3.4');
    expect(() => resolveVitePackage(project, cliModule, false)).toThrow('found vite@8.3.4');
    expect(resolveVitePackage(project, cliModule, true)).toBe(join(projectCore, 'package.json'));
  });

  it('still checks the internal core with the opt-in', () => {
    writeCore(projectCore, 'vite', '8.3.4');
    writeCore(bundled, '@voidzero-dev/vite-plus-core', '0.0.0-stale');
    expect(() => resolveVitePackage(project, cliModule, true)).toThrow(
      'found @voidzero-dev/vite-plus-core@0.0.0-stale',
    );
    expect(() => resolveCore('/pack', cliModule)).toThrow(
      'found @voidzero-dev/vite-plus-core@0.0.0-stale',
    );
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

  it('reports a missing core subpath instead of selecting a project copy', () => {
    writeCore(projectCore);
    rmSync(join(bundled, 'pack.js'));
    expect(() => resolveCore('/pack', cliModule)).toThrow();
  });
});
