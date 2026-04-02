import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath, URL } from 'node:url';
import dts from 'unplugin-dts/vite';
import screwUp from 'screw-up';
import prettierMax from 'prettier-max';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      entryRoot: 'src',
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
    rolldownOptions: {
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
