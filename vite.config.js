import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  appType: 'spa',
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: ([
    process.env.VITE_BASE44_ENABLE === 'true' && base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ]).filter(Boolean),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
      'react': path.resolve(process.cwd(), 'node_modules/react'),
      'react-dom': path.resolve(process.cwd(), 'node_modules/react-dom')
    }
  },
  preview: {
    host: true,
    port: 4173
  },
  server: {
    hmr: false,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
