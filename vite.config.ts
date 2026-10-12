import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, etc.).
  base: process.env.BASE_PATH ?? './',
  // Listen on the LAN so a phone can load the dev server.
  server: { host: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 }, // three.js alone is ~500 kB
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Low Rally',
        short_name: 'Low Rally',
        description: 'A low-poly arcade rally game.',
        theme_color: '#f4c9a0',
        background_color: '#f4c9a0',
        display: 'fullscreen',
        orientation: 'landscape',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell so it runs with no network.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
