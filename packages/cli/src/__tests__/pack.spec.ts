import { expect, test } from 'vitest';

import {
  build,
  defineConfig,
  globalLogger,
  mergeConfig,
  resolveUserConfig,
  buildWithConfigs,
  enableDebug,
} from '../pack.js';

test('should export all pack APIs from the private pack runtime', () => {
  expect(defineConfig).toBeTypeOf('function');
  expect(build).toBeTypeOf('function');
  expect(globalLogger).toBeDefined();
  expect(mergeConfig).toBeTypeOf('function');
  expect(resolveUserConfig).toBeTypeOf('function');
  expect(buildWithConfigs).toBeTypeOf('function');
  expect(enableDebug).toBeTypeOf('function');
});
