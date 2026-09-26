import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      disable: !!process.env.DISABLE_PWA,
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'masked-icon.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        globIgnores: ['favicon.ico'],
        // Nunca interceptar/almacenar respuestas de /api/ para evitar datos obsoletos
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: "Domino's IT Inv",
        short_name: "IT Inv",
        description: "Inventario de equipos tecnológicos de Domino's Pizza",
        theme_color: '#0066CC',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
  },
  server: {
    port: 5173,
    strictPort: false,
    allowedHosts: ['inventario.dominospizza.cl'],
    hmr: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  }
})
