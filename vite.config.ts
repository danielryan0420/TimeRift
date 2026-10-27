import { defineConfig } from 'vite';

export default defineConfig({
  base: '/TimeRift/',
  server: {
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
