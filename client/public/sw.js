// RentShield PWA Service Worker (Always-Fresh Network-First with Zero JS Caching)
const CACHE_NAME = 'rentshield-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Strictly bypass service worker caching for API, JS bundles, CSS, HTML, sockets, and uploads
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/socket') ||
    url.pathname.startsWith('/uploads') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    event.request.mode === 'navigate'
  ) {
    // Pure network fetch — never serve stale JS or outdated bundles
    return;
  }

  // Network-first for static media/assets with cache fallback
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
