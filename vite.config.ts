import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true },
  preview: { host: true },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/playcanvas')) return 'playcanvas';
          if (id.includes('node_modules/@supabase')) return 'supabase';
        }
      }
    }
  }
});
