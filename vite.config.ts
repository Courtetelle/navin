import { execSync } from 'node:child_process';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA as vitePwa } from 'vite-plugin-pwa';

/**
 * The identifier of a build: date and commit.
 * @returns e.g. `2026-11-06 16:20 · 478d41a`.
 */
function buildId(): string {
  const date = new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Europe/Zurich',
  }).format(new Date());
  try {
    const commit = execSync('git rev-parse --short HEAD').toString().trim();
    return `${date} · ${commit}`;
  } catch {
    return date;
  }
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId()),
  },
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
