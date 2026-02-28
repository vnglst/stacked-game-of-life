import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'esnext',
    sourcemap: true
  },
  optimizeDeps: {
    include: ['three']
  }
});
