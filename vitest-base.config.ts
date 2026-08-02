import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    isolate: true,
    maxWorkers: 6,
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
