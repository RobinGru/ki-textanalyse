const CACHE_NAME = 'ki-textanalyse-v1';
const APP_SHELL = [
  './',
  './assets/css/style.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name !== CACHE_NAME)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok && (request.mode === 'navigate' || response.type === 'basic')) {
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return (await cache.match(request))
        ?? (request.mode === 'navigate' ? await cache.match('./') : undefined)
        ?? Response.error();
    }
  })());
});
