import { URL, fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { normalizeApiOrigin } from './src/lib/config/api-url.ts'
import { validateTurnstileSiteKey } from './src/lib/config/turnstile.ts'
import { BRAND_DESCRIPTION, BRAND_NAME } from './src/lib/constants/brand.ts'

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  normalizeApiOrigin(env.VITE_API_URL)
  validateTurnstileSiteKey(env.VITE_TURNSTILE_SITE_KEY, command === 'build')
  return {
    plugins: [
      devtools(),
      tanstackRouter({
        target: 'react',
        autoCodeSplitting: true,
      }),
      // plugin-react 6 dropped Babel: the React Compiler now runs through oxc.
      viteReact({
        compiler: true,
      }),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // The manifest icons are already matched by workbox.globPatterns below.
        // Disable this to avoid duplicate precache entries.
        includeManifestIcons: false,
        manifest: {
          name: BRAND_NAME,
          short_name: BRAND_NAME,
          description: BRAND_DESCRIPTION,
          start_url: '/',
          display: 'standalone',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          icons: [
            {
              src: '/favicon_io/favicon.ico',
              sizes: '16x16 32x32 48x48',
              type: 'image/x-icon',
            },
            {
              src: '/favicon_io/android-chrome-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/favicon_io/android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/favicon_io/maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          // Backend-proxied paths are NOT SPA routes — let the browser navigate to
          // them over the network (Caddy -> backend) instead of serving index.html.
          // Without this the service worker hijacks a full-page nav to an /api
          // endpoint (e.g. an OAuth redirect or file download) and renders the
          // SPA 404 instead of letting the browser reach the backend.
          navigateFallbackDenylist: [
            /^\/api(?:\/|$)/,
            /^\/socket\.io(?:\/|$)/,
            /^\/graphql(?:\/|$)/,
          ],
          globPatterns: ['**/*.{js,css,html,ico,svg,png}'],
          // The root favicon is a legacy copy of the brand icon. The app links
          // and notifications use favicon_io/, so avoid caching both copies.
          globIgnores: ['favicon.ico'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
        },
        devOptions: {
          // A development service worker can keep an old route bundle alive after
          // a hot reload. Keep PWA behavior for production builds only.
          enabled: false,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          // Split the long-lived vendor code out of the app chunk so a UI change
          // doesn't invalidate the whole download for returning users. Vite 8 runs
          // on rolldown, which replaced the `manualChunks` map with named groups.
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /\/node_modules\/(react|react-dom|scheduler)\//,
              },
              {
                name: 'heroui',
                test: /\/node_modules\/(@heroui|@react-aria|@react-stately|framer-motion|motion-dom|motion-utils)\//,
              },
            ],
          },
        },
      },
    },
    server: {
      port: 3001,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
        '/socket.io': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
