import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
      '/socket.io-notifications': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
    allowedHosts: [
      'stopper-thyself-rancidity.ngrok-free.dev',
    ],
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts'
          if (id.includes('@reduxjs/toolkit') || id.includes('react-redux') || id.includes('/redux/')) return 'vendor-state'
          if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'vendor-realtime'
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
