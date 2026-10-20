import assert from 'node:assert/strict';
import { isRunnableDevEnvironment, version } from 'vite';
import { defineConfig, isRunnableDevEnvironment as fromVitePlus } from 'vite-plus';

export default defineConfig({
  server: { host: '127.0.0.1', port: 0 },
  preview: { host: '127.0.0.1', port: 0 },
  pack: { entry: ['entry.ts'], outDir: 'packed', dts: true },
  plugins: [
    {
      name: 'verify-upstream-vite',
      configResolved() {
        if (process.env.EXPECT_PROJECT_CONFIG === '1') {
          assert.equal(process.env.PROJECT_CONFIG_LOADED, '1');
        }
        assert.equal(version, '8.3.4');
        assert.equal(isRunnableDevEnvironment, fromVitePlus);
      },
      configureServer(server) {
        assert.ok(isRunnableDevEnvironment(server.environments.ssr));
        assert.ok(fromVitePlus(server.environments.ssr));
        if (server.httpServer) {
          checkServer(server, 'dev');
          // Model TanStack's SSR middleware: both API surfaces must recognize
          // the environment created by the actual CLI before installing it.
          return () => {
            if (
              isRunnableDevEnvironment(server.environments.ssr) &&
              fromVitePlus(server.environments.ssr)
            ) {
              server.middlewares.use((req, res, next) => {
                if (req.url === '/__ssr_identity') {
                  res.end('Upstream Vite SSR middleware');
                } else {
                  next();
                }
              });
            }
          };
        }
      },
      configurePreviewServer(server) {
        checkServer(server, 'preview');
      },
    },
  ],
});

function checkServer(server, command) {
  server.httpServer.once('listening', async () => {
    try {
      const address = server.httpServer.address();
      assert.ok(address && typeof address === 'object');
      const path = command === 'dev' ? '/__ssr_identity' : '/';
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
        signal: AbortSignal.timeout(10_000),
      });
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Upstream Vite/);
      console.log(`Upstream Vite ${command} served HTTP 200`);
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      if (server.close) {
        await server.close();
      } else {
        server.httpServer.close();
      }
    }
  });
}
