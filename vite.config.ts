import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: resolve(fileURLToPath(new URL('.', import.meta.url)), 'src/index.ts'),
      name: 'AsyncPrimitives',
      formats: ['es', 'cjs'],
      fileName: (format) => `async-primitives.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    target: 'es2018',
    minify: false,
  },
}) 