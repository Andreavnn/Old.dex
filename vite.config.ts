import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const rulesProxy = {
  '/tow-source': {
    target: 'https://tow.whfb.app',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/tow-source/, ''),
  },
}

export default defineConfig({
  plugins: [vue()],
  server: { proxy: rulesProxy },
  preview: { proxy: rulesProxy },
})
