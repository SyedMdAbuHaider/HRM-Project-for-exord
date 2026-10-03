import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/upload': {
            target: 'http://localhost:8080',
            changeOrigin: true,
          },
          '/files': {
            target: 'http://localhost:8080',
            changeOrigin: true,
          },
          '/file-health': {
            target: 'http://localhost:8080',
            changeOrigin: true,
            rewrite: () => '/health',
          },
          '/probe': {
            target: 'http://localhost:8081',
            changeOrigin: true,
          },
          '/email': {
            target: 'http://localhost:8081',
            changeOrigin: true,
          },
        },
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Fix: vendor-react removed — React 19 ESM resolves inline, chunk was 0 bytes
              // Recharts — only needed on dashboard
              'vendor-charts': ['recharts'],
              // Leaflet — only needed on live tracking view
              'vendor-leaflet': ['leaflet'],
              // Lucide icons — tree-shaken but still sizeable
              'vendor-icons': ['lucide-react'],
            },
          },
        },
      },
    };
});
