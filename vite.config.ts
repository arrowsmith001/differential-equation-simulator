import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [preact()],
  build: {
    assetsInlineLimit: 0
  },
  assetsInclude: ["**/*.woff2", "**/*.woff"],
  base: "https://arrowsmith001.github.io/differential-equation-simulator/"
})
