import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor packages for better caching
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy API calls to Cloudflare Workers during development
      '/api': {
        target: 'http://localhost:8787', // Wrangler dev server
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
  },
  css: {
    postcss: './postcss.config.js',
  },
  define: {
    // Define build-time constants
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // Environment variables that are safe to expose to the client
  envPrefix: 'VITE_',
});