import { bundledDataPlugin } from './scripts/lib/bundledDataPlugin'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { buildAppVersion } from './buildAppVersion.mts'

const output = resolve('dist/web')

export default defineConfig(({ mode }) => ({
  root: resolve('src/renderer'),
  envDir: resolve('.'),
  base: './',
  define: { __WEB_BUILD__: true, __APP_VERSION__: JSON.stringify(buildAppVersion(mode)) },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
    },
  },
  build: {
    outDir: output,
    emptyOutDir: true,
    license: { fileName: 'THIRD_PARTY_LIBRARIES.md' },
  },
  plugins: [react(), bundledDataPlugin(output)],
}))
