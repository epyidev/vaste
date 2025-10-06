import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'configure-csp',
      configureServer: (server) => {
        server.middlewares.use((_req, res, next) => {
          // En développement, CSP permissive pour permettre les connexions à n'importe quel game server
          // En production, la CSP stricte sera gérée par le serveur web (nginx, etc.)
          if (mode === 'development') {
            res.setHeader(
              'Content-Security-Policy',
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob: http://* https://*; " +
              "connect-src 'self' ws://* wss://* http://* https://*; " +
              "font-src 'self' data:; " +
              "worker-src 'self' blob:;"
            );
          }
          next();
        });
      }
    }
  ],
  root: './client',
  build: {
    outDir: './dist',
    emptyOutDir: true
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true
  }
}))
