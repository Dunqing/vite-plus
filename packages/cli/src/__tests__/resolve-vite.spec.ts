import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveViteBin, resolveViteRoot } from '../resolve-vite.ts';

describe('resolveViteBin', () => {
  it.each([
    { name: 'vite', bin: { vite: './custom/cli.js' }, entry: 'custom/cli.js' },
    { name: 'vite', bin: './custom/cli.js', entry: 'custom/cli.js' },
    { name: '@voidzero-dev/vite-plus-core', entry: 'dist/vite/bin/vite.js' },
  ])('resolves the CLI for $name with $entry', ({ name, bin, entry }) => {
    const root = mkdtempSync(join(tmpdir(), 'vp-vite-bin-'));
    try {
      const manifest = join(root, 'package.json');
      writeFileSync(manifest, JSON.stringify({ name, bin }));
      mkdirSync(join(root, entry, '..'), { recursive: true });
      writeFileSync(join(root, entry), '');
      expect(resolveViteBin(manifest)).toBe(join(root, entry));
      rmSync(join(root, entry));
      expect(() => resolveViteBin(manifest)).toThrow('Could not find the Vite CLI');
      writeFileSync(manifest, JSON.stringify({ name: 'vite' }));
      expect(() => resolveViteBin(manifest)).toThrow("Could not find 'vite' bin entry");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('resolveViteRoot', () => {
  const cwd = resolve('workspace');

  it.each(
    [
      [],
      ['--mode', 'production'],
      ['--outDir', 'dist', '--emptyOutDir'],
      ['--host', '127.0.0.1', '--port', '4173'],
      ['--sourcemap', 'inline'],
    ].map((args) => ({ args })),
  )('uses the dispatched cwd for $args', ({ args }) => {
    expect(resolveViteRoot({ cwd, args })).toBe(cwd);
  });

  it.each(
    [
      ['packages/app'],
      ['packages/app', '--mode', 'production'],
      ['--mode', 'production', 'packages/app'],
      ['-m=production', 'packages/app'],
      ['--outDir=dist', 'packages/app'],
      ['--emptyOutDir', 'packages/app'],
      ['--no-clearScreen', 'packages/app'],
      ['-w', 'packages/app'],
      ['--strictPort', 'packages/app'],
      ['--host', '127.0.0.1', 'packages/app'],
      ['--sourcemap', 'inline', 'packages/app'],
      ['packages/app', '--', 'ignored'],
    ].map((args) => ({ args })),
  )('resolves the positional root in $args', ({ args }) => {
    expect(resolveViteRoot({ cwd, args })).toBe(resolve(cwd, 'packages/app'));
  });
});
