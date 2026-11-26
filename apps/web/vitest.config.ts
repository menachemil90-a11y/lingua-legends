import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: '@lingua/web', include: ['src/**/*.test.ts'], environment: 'node' },
});
