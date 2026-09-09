import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import counterConfig from './counter/public-config.json';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/-n-g-c-ng-c/',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  define: { 'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify('/-n-g-c-ng-c'), 'process.env.NEXT_PUBLIC_COUNTER_API_URL': JSON.stringify(process.env.NEXT_PUBLIC_COUNTER_API_URL || counterConfig.apiUrl) },
  build: { outDir: 'dist-pages', emptyOutDir: true },
});
