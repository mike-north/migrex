import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: false, // We use api-extractor for declarations
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  splitting: false, // Ensure single bundle for ESM
  bundle: true,
});
