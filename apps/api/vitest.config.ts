import { defineConfig } from 'vitest/config';

// `source` resolves workspace packages to their TypeScript sources, so tests don't need a build.
const conditions = ['source'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    setupFiles: [],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});
