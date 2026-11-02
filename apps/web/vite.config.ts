import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tempoVitePlugin } from 'tempo-sdk';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [tempoVitePlugin(), react()],
  server: {
    host: 'localhost', port: Number(process.env.KODA_WEB_PORT ?? 5173), strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:' + Number(process.env.KODA_API_PORT ?? 3001), changeOrigin: false } },
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))], deny: ['**/.demo/**', '**/local-design/**', '**/docs/**', '**/apps/api/**', '**/.git/**', '**/.env*', '**/*.sqlite*', '**/*.pem'] },
    headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' },
  },
  build: { sourcemap: false },
});
