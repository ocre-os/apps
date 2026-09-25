
const CACHE_NAME = 'ocre-cizalla-v3-2026-09-11';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Navegación/documentos: NETWORK FIRST.
  // Si hay internet, siempre intenta cargar la versión del servidor.
  if (req.mode === 'navigate' || (req.destination === 'document')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(async () => {
          return (await caches.match(req)) ||
                 (await caches.match('./index.html')) ||
                 Response.error();
        })
    );
    return;
  }

  // Recursos locales: cache-first con revalidación en segundo plano.
  event.respondWith(
    caches.match(req).then(cached => {
      const networkFetch = fetch(req).then(response => {
        if (response && response.ok && req.method === 'GET') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});
