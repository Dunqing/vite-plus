import { expect, test } from 'vite-plus/test';
import * as vite from 'vite';
import * as vp from 'vite-plus';

test('uses the replacement Vite through public API exports', async () => {
  expect(vp.version).toBe('8.3.4');
  expect(vp.createServer).toBe(vite.createServer);
  if (process.env.LOCAL_VITE === '1') {
    expect(vp.ecosystemCiMarker).toBe('local-vite');
  }
  const server = await vp.createServer({ configFile: false, server: { middlewareMode: true } });
  try {
    expect(vite.isRunnableDevEnvironment(server.environments.ssr)).toBe(true);
  } finally {
    await server.close();
  }
});
