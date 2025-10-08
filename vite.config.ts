import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';
import dts from 'vite-plugin-dts';
import screwUp from 'screw-up';
import prettierMax from 'prettier-max';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
    screwUp({
      outputMetadataFile: true,
    }),
    prettierMax(),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'async-primitives',
      fileName: (format, entryName) =>
        `${entryName}.${format === 'es' ? 'mjs' : 'cjs'}`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    target: 'es2018',
    minify: false,
    sourcemap: true,
  },
});
