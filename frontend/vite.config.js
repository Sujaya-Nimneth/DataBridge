import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Astryx core is one interconnected module graph: AppShell/SideNav reach
    // most of it, so it lands as a single cacheable ~176KB-gzip chunk. Lazy
    // routes keep our own code split; revisit if core adds finer entry points.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Astryx core is large and shared by every route; splitting it out of
        // the app entry keeps the initial chunk small and lets the browser
        // cache the component library independently of our code.
        manualChunks(id) {
          if (id.includes('node_modules/@astryxdesign/core/')) return 'astryx-core';
          if (id.includes('node_modules/@astryxdesign/theme-neutral/')) return 'astryx-theme';
          if (id.includes('node_modules/@astryxdesign/') || id.includes('node_modules/@stylexjs/'))
            return 'astryx';
          if (
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/react-hot-toast') ||
            id.includes('node_modules/react-icons')
          ) {
            return 'vendor';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
