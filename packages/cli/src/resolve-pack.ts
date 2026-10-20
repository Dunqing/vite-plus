import { join } from 'node:path';

import type { JsCommandResolvedResult } from '../binding/index.js';
import { resolveCore } from './resolve-core.ts';
import { DEFAULT_ENVS } from './utils/constants.ts';

/** Validate the internal core before starting the bundled pack entry. */
export async function pack(err: Error | null): Promise<JsCommandResolvedResult> {
  if (err) {
    throw err;
  }
  resolveCore('/pack');
  return {
    binPath: join(import.meta.dirname, 'pack-bin.js'),
    envs: { ...DEFAULT_ENVS },
  };
}
