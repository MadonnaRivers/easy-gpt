import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/app/' : '/',
  server: {
    port: 3000,
    open: true,
    allowedHosts: [
      '318c72e46e33.ngrok-free.app',
      '27bc46a5170c.ngrok-free.app',
      '.ngrok-free.app',
      '.ngrok.io'
    ],
    proxy: {
      '/api/n8n': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/n8n/, '/webhook/e61a4f26-156f-4802-ae33-743399345186/chat'),
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type';
          });
        },
      },
      // File upload: same-origin in dev to avoid CORS; Vite forwards to n8n UAT
      '/api/upload': {
        target: 'https://uat-n8n.easyhomefinance.in',
        changeOrigin: true,
        rewrite: () => '/webhook/bfeed288-3ed4-4428-9b28-b39842289d3c',
        secure: true,
      },
      '/api/dashboard-access': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      // JWT verify: same-origin in dev → forwards to n8n (matches server N8N_JWT_VERIFY_URL default)
      '/api/verify-jwt': {
        target: 'https://uat-n8n.easyhomefinance.in',
        changeOrigin: true,
        rewrite: () => '/webhook/verify_jwt',
        secure: true,
      },
    }
  }
})

