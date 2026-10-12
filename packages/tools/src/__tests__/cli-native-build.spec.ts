import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const { buildNative, stopBuild } = vi.hoisted(() => ({
  buildNative: vi.fn(),
  stopBuild: new Error('Stop before native compilation'),
}));

vi.mock('@napi-rs/cli', async (importOriginal) => {
  const original = await importOriginal<typeof import('@napi-rs/cli')>();
  return {
    ...original,
    NapiCli: class {
      build = buildNative;
    },
  };
});

const originalArgv = process.argv;

beforeEach(() => {
  vi.resetModules();
  buildNative.mockReset();
  buildNative.mockRejectedValue(stopBuild);
});

afterEach(() => {
  process.argv = originalArgv;
});

const bindingAndCliPackages = ['--package', 'vite-plus-cli', '--package', 'vp_global_cli'];

test.each([
  {
    name: 'Windows binding only',
    target: 'x86_64-pc-windows-msvc',
    nativeArgs: ['-x'],
    cargoOptions: [],
  },
  {
    name: 'Windows binding and CLI packages',
    target: 'x86_64-pc-windows-msvc',
    nativeArgs: ['-x'],
    cargoOptions: [...bindingAndCliPackages, '--package', 'vp_installer'],
  },
  {
    name: 'Linux glibc binding and CLI packages',
    target: 'x86_64-unknown-linux-gnu',
    nativeArgs: ['--use-napi-cross'],
    cargoOptions: bindingAndCliPackages,
  },
  {
    name: 'Linux musl binding and CLI packages',
    target: 'x86_64-unknown-linux-musl',
    nativeArgs: ['-x'],
    cargoOptions: bindingAndCliPackages,
  },
  {
    name: 'macOS binding and CLI packages',
    target: 'aarch64-apple-darwin',
    nativeArgs: [],
    cargoOptions: bindingAndCliPackages,
  },
])(
  'passes Cargo arguments to the native build: $name',
  async ({ target, nativeArgs, cargoOptions }) => {
    process.argv = [
      process.execPath,
      'build.ts',
      '--skip-ts',
      '--skip-format',
      '--target',
      target,
      ...nativeArgs,
      '--',
      ...cargoOptions,
    ];

    // Exercise the build entry point and real NAPI argument parser. Stop at the
    // compiler boundary so the test does not compile or write build artifacts.
    await expect(import('../../../cli/build.ts')).rejects.toBe(stopBuild);
    expect(buildNative).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        target,
        crossCompile: nativeArgs.includes('-x') ? true : undefined,
        useNapiCross: nativeArgs.includes('--use-napi-cross') ? true : undefined,
        features: ['rolldown'],
        cargoOptions,
      }),
    );
  },
);
