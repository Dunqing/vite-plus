import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { readNearestPackageJson } from './utils/package.ts';

const CORE_PACKAGE_NAME = '@voidzero-dev/vite-plus-core';

function checkCoreVersion(packageJsonPath: string, expectedVersion: string): void {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string;
    version?: string;
  };
  if (pkg.name !== CORE_PACKAGE_NAME || pkg.version !== expectedVersion) {
    throw new Error(
      `Expected ${CORE_PACKAGE_NAME}@${expectedVersion}, but found ${pkg.name}@${pkg.version} at ${packageJsonPath}. ` +
        'Run `vp migrate` to align the Vite alias, then run `vp install`.',
    );
  }
}

function resolveProjectVitePackage(
  cwd: string,
  expectedVersion: string,
  allowUpstream: boolean,
): string | undefined {
  // npm can hoist an upstream Vite peer even when the project only declares
  // vite-plus. Validate Vite only when the nearest package declares it.
  const projectPackage = readNearestPackageJson(cwd);
  const declaresVite = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ].some((field) => Object.hasOwn(projectPackage?.[field] ?? {}, 'vite'));
  if (!declaresVite) {
    if (allowUpstream) {
      throw new Error('VP_USE_PROJECT_VITE=1 requires a declared project Vite dependency.');
    }
    return undefined;
  }

  const projectRequire = createRequire(join(cwd, 'package.json'));
  let projectPackageJsonPath: string | undefined;
  try {
    projectPackageJsonPath = projectRequire.resolve('vite/package.json');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
      throw cause;
    }
  }
  if (projectPackageJsonPath) {
    const pkg = JSON.parse(readFileSync(projectPackageJsonPath, 'utf8')) as { name?: string };
    if (!(allowUpstream && pkg.name === 'vite')) {
      checkCoreVersion(projectPackageJsonPath, expectedVersion);
    }
  } else if (allowUpstream) {
    throw new Error('Could not resolve the project Vite dependency. Run `vp install`.');
  }
  return projectPackageJsonPath;
}

/** Resolve Vite from the same dependency as the CLI's static public exports. */
export function resolveVitePackage(
  cwd: string,
  modulePath = import.meta.url,
  useProjectVite = process.env.VP_USE_PROJECT_VITE === '1',
): string {
  const cliRequire = createRequire(modulePath);
  // Read the installed version after preview/local packers have stamped it.
  const { version } = JSON.parse(
    readFileSync(cliRequire.resolve('vite-plus/package.json'), 'utf8'),
  ) as { version: string };
  let vitePackageJsonPath: string;
  try {
    vitePackageJsonPath = cliRequire.resolve('vite/package.json');
  } catch (cause) {
    throw new Error('Could not resolve the bundled Vite dependency. Run `vp install`.', { cause });
  }
  const projectPackageJsonPath = resolveProjectVitePackage(cwd, version, useProjectVite);
  if (useProjectVite) {
    // Version equality does not establish module identity. Even the opt-in
    // must keep the active server and public Vite APIs on the same package.
    if (projectPackageJsonPath !== vitePackageJsonPath) {
      throw new Error(
        'VP_USE_PROJECT_VITE=1 requires the project and vite-plus to resolve the same Vite package. ' +
          `Project: ${projectPackageJsonPath}. CLI: ${vitePackageJsonPath}. ` +
          'Apply the same override to all `vite` dependencies, including `vite-plus>vite`, then run `vp install`.',
      );
    }
  } else {
    checkCoreVersion(vitePackageJsonPath, version);
  }
  return vitePackageJsonPath;
}
