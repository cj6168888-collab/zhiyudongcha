import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  optimizeDeps: {
    entries: [],
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    isolate: false,
    fileParallelism: false,
    setupFiles: ['./server/tests/setup.ts'],
    include: ['./tests/routes/health.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'tests/e2e/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.d.ts',
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src'),
      '@shared': resolve(__dirname, './shared'),
      '@server': resolve(__dirname, './server'),
    },
  },
});
