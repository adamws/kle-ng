import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Suppress Sass deprecation warnings from Bootstrap
        quietDeps: true,
        // Additional options to suppress specific warnings
        silenceDeprecations: ['import', 'global-builtin', 'color-functions']
      }
    }
  },
  server: {
    proxy: {
      // Proxy API requests to backend in development
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
