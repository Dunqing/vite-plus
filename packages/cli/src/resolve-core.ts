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
  corePackageJsonPath: string,
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
    if (projectPackageJsonPath !== corePackageJsonPath && !(allowUpstream && pkg.name === 'vite')) {
      checkCoreVersion(projectPackageJsonPath, expectedVersion);
    }
  } else if (allowUpstream) {
    throw new Error('Could not resolve the project Vite dependency. Run `vp install`.');
  }
  return projectPackageJsonPath;
}

/** Resolve and validate the internal core independently of Vite overrides. */
export function resolveCore(subpath = '', modulePath = import.meta.url): string {
  const cliRequire = createRequire(modulePath);
  // Read the selected CLI's installed manifest. A static JSON import is inlined
  // during the build, before CI and preview packers can stamp a new version.
  const { version: expectedVersion } = JSON.parse(
    readFileSync(cliRequire.resolve('vite-plus/package.json'), 'utf8'),
  ) as { version: string };
  let corePackageJsonPath: string;
  try {
    corePackageJsonPath = cliRequire.resolve(`${CORE_PACKAGE_NAME}/package.json`);
  } catch (cause) {
    throw new Error('Could not resolve the bundled Vite dependency. Run `vp install`.', { cause });
  }
  checkCoreVersion(corePackageJsonPath, expectedVersion);

  return cliRequire.resolve(`${CORE_PACKAGE_NAME}${subpath}`);
}

/** Resolve the Vite used for dev/build/preview, preserving normal alias checks. */
export function resolveVitePackage(
  cwd: string,
  modulePath = import.meta.url,
  useProjectVite = process.env.VP_USE_PROJECT_VITE === '1',
): string {
  const corePackageJsonPath = resolveCore('/package.json', modulePath);
  const { version } = JSON.parse(readFileSync(corePackageJsonPath, 'utf8')) as { version: string };
  const projectPackageJsonPath = resolveProjectVitePackage(
    cwd,
    corePackageJsonPath,
    version,
    useProjectVite,
  );
  if (useProjectVite) {
    return projectPackageJsonPath!;
  }

  // Public API re-exports still use `vite`. Validate that dependency as well,
  // so normal commands cannot silently run a different Vite than API imports.
  const vitePackageJsonPath = createRequire(modulePath).resolve('vite/package.json');
  checkCoreVersion(vitePackageJsonPath, version);
  return vitePackageJsonPath;
}
