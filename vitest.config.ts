import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'website/src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
});
