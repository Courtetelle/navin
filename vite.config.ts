import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA as vitePwa } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative base: the same build works under any GitHub Pages sub-path.
  base: './',
  plugins: [
    react(),
    vitePwa({
      strategies: 'injectManifest',
      srcDir: 'src/serviceWorker',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
});
