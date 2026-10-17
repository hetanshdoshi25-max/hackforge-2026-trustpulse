import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const enableSsl = env.VITE_ENABLE_SSL === 'true' || process.env.HTTPS === 'true'
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://127.0.0.1:8000'
  const wsTarget = backendTarget.replace(/^http/, 'ws')

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(enableSsl ? [basicSsl()] : []),
    ],
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: wsTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        external: ['hls.js'],
      },
    },
  }
})
