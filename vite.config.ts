import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Only enable PWA in production builds to avoid service worker
    // interfering with dev server and E2E test route mocking
    ...(command === 'build'
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            workbox: {
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/api\.github\.com\/repos\/.*\/git\/trees\/.*/,
                  handler: 'StaleWhileRevalidate',
                  options: {
                    cacheName: 'github-tree-cache',
                    expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
                    cacheableResponse: { statuses: [0, 200, 304] },
                  },
                },
                {
                  urlPattern: /^https:\/\/api\.github\.com\/repos\/.*\/branches/,
                  handler: 'StaleWhileRevalidate',
                  options: {
                    cacheName: 'github-branches-cache',
                    expiration: { maxEntries: 20, maxAgeSeconds: 1800 },
                    cacheableResponse: { statuses: [0, 200] },
                  },
                },
              ],
            },
            manifest: {
              name: 'GitSparse Pro',
              short_name: 'GitSparse',
              description: 'Selective client-side GitHub folder downloads',
              theme_color: '#10b981',
              background_color: '#0f172a',
              display: 'standalone',
              icons: [
                { src: 'logo.png', sizes: '192x192', type: 'image/png' },
                { src: 'logo.png', sizes: '512x512', type: 'image/png' },
              ],
            },
          }),
        ]
      : []),
  ],
  base: process.env.GITHUB_ACTIONS ? '/gitsparse/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.unit.test.ts', 'src/**/*.unit.test.tsx'],
    alias: {
      '@/': path.resolve(__dirname, './src') + '/',
    },
  },
}));
