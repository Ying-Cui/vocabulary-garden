const CACHE_NAME = 'kotoba-garden-v2-p93-115-4';
const APP_ROOT = new URL('./', self.registration.scope);
const INDEX_URL = new URL('./index.html', APP_ROOT);
const CORE_URLS = [
  APP_ROOT.href,
  INDEX_URL.href,
  new URL('./manifest.webmanifest', APP_ROOT).href,
  new URL('./icon.svg', APP_ROOT).href,
  new URL('./icons/apple-touch-icon.png', APP_ROOT).href,
  new URL('./icons/icon-192.png', APP_ROOT).href,
  new URL('./icons/icon-512.png', APP_ROOT).href,
  new URL('./icons/icon-maskable-512.png', APP_ROOT).href
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const indexResponse = await fetch(INDEX_URL, { cache: 'reload' });
    const indexText = await indexResponse.clone().text();
    const linkedAssets = [...indexText.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map((match) => new URL(match[1], APP_ROOT))
      .filter((url) => url.origin === self.location.origin)
      .map((url) => url.href);

    await cache.put(INDEX_URL, indexResponse);
    await cache.addAll([...new Set([...CORE_URLS, ...linkedAssets])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((name) => name.startsWith('kotoba-garden-') && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(INDEX_URL, response.clone());
        return response;
      } catch {
        return (await caches.match(INDEX_URL)) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
