import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Em desenvolvimento, /api vai para o backend (Spring Boot em 8080) ou para a API simulada (npm run mock),
// do mesmo jeito que a Vercel repassa /api para a VPS em produção.
const API = process.env.API_URL || 'http://localhost:8080';

export default defineConfig({
  plugins: [vue()],
  // base relativa: a pasta dist funciona em qualquer subcaminho do servidor
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': { target: API, changeOrigin: false } } },
  test: { environment: 'node' },
});
