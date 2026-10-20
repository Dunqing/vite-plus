import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { cac } from 'cac';

import type { JsCommandContext, JsCommandResolvedResult } from '../binding/index.js';
import { resolveVitePackage } from './resolve-core.ts';
import { DEFAULT_ENVS } from './utils/constants.ts';

export function resolveViteRoot({ cwd, args }: JsCommandContext): string {
  const cli = cac();
  const command = cli.command('[root]').allowUnknownOptions();
  // Match Vite's boolean options so cac does not consume the following root
  // as an option value. Other Vite options accept a required or optional value.
  for (const flag of [
    '--clearScreen',
    '--cors',
    '--strictPort',
    '--force',
    '--experimentalBundle',
    '--emptyOutDir',
    '-w, --watch',
    '--app',
    '-h, --help',
    '-v, --version',
  ]) {
    command.option(flag, '');
  }
  const parsed = cli.parse(['node', 'vite', ...args], { run: false });
  return resolve(cwd, parsed.args[0] ?? '.');
}

/** Use the core's bundled entry or upstream Vite's public bin entry. */
export function resolveViteBin(packageJsonPath: string): string {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    name?: string;
    bin?: string | { vite?: string };
  };
  const bin =
    pkg.name === '@voidzero-dev/vite-plus-core'
      ? 'dist/vite/bin/vite.js'
      : typeof pkg.bin === 'string'
        ? pkg.bin
        : pkg.bin?.vite;
  if (!bin) {
    throw new Error(`Could not find 'vite' bin entry in ${packageJsonPath}`);
  }
  const binPath = resolve(dirname(packageJsonPath), bin);
  if (!existsSync(binPath)) {
    throw new Error(`Could not find the Vite CLI at ${binPath}. Run \`vp install\`.`);
  }
  return binPath;
}

/** Resolve the CLI for dev, build, and preview from the selected project root. */
export async function vite(
  err: Error | null,
  context: JsCommandContext,
): Promise<JsCommandResolvedResult> {
  if (err) {
    throw err;
  }
  const binPath = resolveViteBin(resolveVitePackage(resolveViteRoot(context)));

  const envs: Record<string, string> = { ...DEFAULT_ENVS };
  if (process.env.DEBUG_DISABLE_SOURCE_MAP) {
    envs.DEBUG_DISABLE_SOURCE_MAP = process.env.DEBUG_DISABLE_SOURCE_MAP;
  }
  return { binPath, envs };
}
