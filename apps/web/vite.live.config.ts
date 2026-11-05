import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5190, strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))], deny: ['**/.demo/**', '**/.git/**', '**/.env*', '**/*.pem', '**/*.sqlite*', '**/apps/api/**'] },
    headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' },
  },
  build: { outDir: 'dist-live', rollupOptions: { input: fileURLToPath(new URL('./live.html', import.meta.url)) } },
});
