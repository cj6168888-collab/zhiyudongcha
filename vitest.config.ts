import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'threads',
    fileParallelism: false,
    setupFiles: ['./server/tests/setup.ts'],
    include: [
      './server/tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      './tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
      './tests/lib/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'tests/e2e/**',
      'playwright-report/**',
      'test-results/**',
      '**/*.d.ts',
      '**/*.test-d.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'server/**/*.ts',
        'shared/**/*.ts',
        'client/src/**/*.ts',
      ],
      exclude: [
        'server/**/*.test.ts',
        'server/**/*.spec.ts',
        'server/lib/query-optimizer.ts',
        'server/services/base-service.ts',
        'tests/**/*.ts',
        '**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
      ],
      thresholds: {
        // Baseline guard for the current broad include set. Raise these as
        // service and route coverage grows; do not treat them as the target.
        global: {
          branches: 3,
          functions: 4,
          lines: 5,
          statements: 5,
        },
      },
    },
    // 测试超时
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
