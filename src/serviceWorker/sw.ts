/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const precache = self.__WB_MANIFEST;

self.addEventListener('install', (event) => {
  event.waitUntil(
    self.caches
      .open('navin-app')
      .then((cache) => cache.addAll(precache.map((entry) => entry.url)))
      .then(() => self.skipWaiting()),
  );
});
