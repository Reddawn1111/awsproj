import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/lambda': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lambda/, '')
      },
      '/api/bhuvan': {
        target: 'https://bhuvan-vec1.nrsc.gov.in',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/bhuvan/, '')
      },
      '/api/overpass': {
        target: 'https://overpass-api.de',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/overpass/, ''),
        headers: {
          'User-Agent': '4clique-EnvironmentalIntel/1.0'
        }
      }
    }
  }
});
