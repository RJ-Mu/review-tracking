import { defineConfig } from 'vite';

export default defineConfig({
  base: '/review-tracking/',
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
  
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },
});