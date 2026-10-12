import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works from any sub-path (GitHub Pages, etc.).
  base: process.env.BASE_PATH ?? './',
  // Listen on the LAN so a phone can load the dev server.
  server: { host: true },
  build: { target: 'es2022' },
});
