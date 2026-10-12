export function patchVibeDashboardConfig(config: string): string {
  const plugins = /plugins:\s*\[tailwindcss\(\)\]/g;
  if ([...config.matchAll(plugins)].length !== 1) {
    throw new Error('vibe-dashboard patch: expected the pinned browser project plugins');
  }
  return config.replace(
    plugins,
    `plugins: [tailwindcss(), {
      name: 'vibe-dashboard:test:browser-port',
      enforce: 'post',
      config: {
        order: 'post',
        handler(config) {
          // Vitest resolves port 0 to its default before this hook runs.
          // Let the OS choose the browser project's port when the server binds.
          if (config.test?.api && typeof config.test.api === 'object') {
            config.test.api.port = 0;
          }
        },
      },
    }]`,
  );
}
