// Offline support for gecko-games.
// Bump VERSION whenever a game file changes so installed apps pick up the update.
const VERSION = 'v2';
const CACHE = `gecko-games-${VERSION}`;

const PAGES = [
  '/', '/index.html',
  '/2048.html', '/brick-breaker.html', '/cosmic-blaster.html', '/dino.html',
  '/last-frontier.html', '/memory-match.html', '/sky-hop.html', '/snake.html',
  '/tic-tac-toe.html', '/vector-drift.html',
  '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png',
];

// Third-party files the games load (fonts and the 3D engine for Last Frontier)
const EXTERNAL = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&display=swap',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
];
const EXTERNAL_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(PAGES);
    // External files are nice-to-have; don't fail the install if one is unreachable
    await Promise.all(EXTERNAL.map((url) =>
      fetch(url, { mode: 'no-cors' }).then((res) => cache.put(url, res)).catch(() => {})
    ));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => (k.startsWith('gecko-games-') || k.startsWith('mini-games-')) && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Game pages: try the network for the latest version, fall back to the cache offline
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      } catch {
        return (await cache.match(request, { ignoreSearch: true })) ||
          (request.mode === 'navigate' ? cache.match('/index.html') : Response.error());
      }
    })());
    return;
  }

  // Fonts and libraries never change at a given URL, so serve from cache first
  if (EXTERNAL_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(request);
      if (hit) return hit;
      try {
        const res = await fetch(request);
        cache.put(request, res.clone());
        return res;
      } catch {
        return Response.error();
      }
    })());
  }
});
