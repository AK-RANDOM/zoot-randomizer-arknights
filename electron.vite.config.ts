import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { buildAppVersion } from './buildAppVersion.mts'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  main: {
    build: { externalizeDeps: true },
  },
  preload: {
    build: { externalizeDeps: true },
  },
  renderer: {
    root: resolve('src/renderer'),
    define: { __WEB_BUILD__: false, __APP_VERSION__: JSON.stringify(buildAppVersion(mode)) },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
  },
}))
