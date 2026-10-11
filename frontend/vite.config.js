import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// In dev the API is proxied, so the browser only ever talks to one origin (no CORS).
// In Docker, nginx does the same job (see nginx.conf).
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // A separate registerSW.js file, because the page's Content-Security-Policy forbids inline scripts.
      injectRegister: 'script',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Avshesh',
        short_name: 'Avshesh',
        description: 'Turn neighbourhood waste into income',
        theme_color: '#1d673d',
        background_color: '#f0faf3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app's own files are cached, so it opens without a network. API answers (listings, money,
        // notifications) are never cached: another person on a shared phone must not see them.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/actuator\//],
        globPatterns: ['**/*.{js,css,html,svg,png}'],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
