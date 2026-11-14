import { cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { buildAppVersion } from './buildAppVersion.mts'

const output = resolve('dist/web')
const bundled = resolve('resources/bundled-data/operators')

export default defineConfig(({ mode }) => ({
  root: resolve('src/renderer'),
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
  plugins: [
    react(),
    {
      name: 'bundled-operator-data',
      apply: 'build',
      writeBundle() {
        const destination = resolve(output, 'operator-data')
        mkdirSync(destination, { recursive: true })
        cpSync(resolve(bundled, 'operators.json'), resolve(destination, 'operators.json'))
      },
    },
  ],
}))
