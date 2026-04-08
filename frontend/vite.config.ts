import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/flux-workflow/',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/flux-workflow/api': {
        target: 'http://localhost:8006',
        changeOrigin: true,
      },
    },
  },
})