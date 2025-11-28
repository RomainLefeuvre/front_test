import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  define: {
    // Make environment variables available
    'import.meta.env.VITE_S3_ENDPOINT': JSON.stringify(process.env.VITE_S3_ENDPOINT),
    'import.meta.env.VITE_S3_BUCKET': JSON.stringify(process.env.VITE_S3_BUCKET),
    'import.meta.env.VITE_S3_REGION': JSON.stringify(process.env.VITE_S3_REGION),
  },
  // Configure for development and production modes
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'duckdb': ['@duckdb/duckdb-wasm'],
        },
      },
    },
  },
})
