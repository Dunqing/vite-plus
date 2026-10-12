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

test.each([
  { name: 'binding only', cargoOptions: [] },
  {
    name: 'binding and CLI packages',
    cargoOptions: [
      '--package',
      'vite-plus-cli',
      '--package',
      'vp_global_cli',
      '--package',
      'vp_installer',
    ],
  },
])('passes Cargo arguments to the native build: $name', async ({ cargoOptions }) => {
  process.argv = [
    process.execPath,
    'build.ts',
    '--skip-ts',
    '--skip-format',
    '--target',
    'x86_64-pc-windows-msvc',
    '-x',
    '--',
    ...cargoOptions,
  ];

  // Exercise the build entry point and real NAPI argument parser. Stop at the
  // compiler boundary so the test does not compile or write build artifacts.
  await expect(import('../../../cli/build.ts')).rejects.toBe(stopBuild);
  expect(buildNative).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      target: 'x86_64-pc-windows-msvc',
      crossCompile: true,
      features: ['rolldown'],
      cargoOptions,
    }),
  );
});
