import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  esbuild: { jsx: 'automatic' }, // tests import .tsx modules (visual-kit templates)
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
