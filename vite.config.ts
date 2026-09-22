import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: true },
  preview: { host: true },
  build: { target: 'es2022' }
});
