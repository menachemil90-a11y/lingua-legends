import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  splitting: false,
  // Workspace packages are TypeScript sources; bundle them into the server build.
  noExternal: [/^@lingua\//],
});
