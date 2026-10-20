import { join } from 'node:path';

import type { JsCommandResolvedResult } from '../binding/index.js';
import { DEFAULT_ENVS } from './utils/constants.ts';

/** Start the pack runtime shipped with this CLI. */
export async function pack(err: Error | null): Promise<JsCommandResolvedResult> {
  if (err) {
    throw err;
  }
  return {
    binPath: join(import.meta.dirname, 'pack-bin.js'),
    envs: { ...DEFAULT_ENVS },
  };
}
