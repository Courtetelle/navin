import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA as vitePwa } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base: the same build works under any GitHub Pages sub-path.
  base: './',
  // Derived from the project creation date (2026-11-05 gives 11105), so that
  // two checkouts of different projects never fight over Vite's default port.
  server: { port: 11106, strictPort: true },
  preview: { port: 11105, strictPort: true },
  plugins: [
    react(),
    vitePwa({
      strategies: 'injectManifest',
      srcDir: 'src/serviceWorker',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,bin}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
});
