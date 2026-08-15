/*
 * RCT Application service worker.
 *
 * Deliberately conservative. This is a service-management system where a
 * stale ticket status is actively dangerous — an engineer must never be
 * shown a cached "open" ticket that a colleague closed twenty minutes ago.
 *
 * Therefore:
 *   - API and auth traffic is NEVER cached
 *   - navigations are network-first, falling back to a cached shell only
 *     when the device is genuinely offline
 *   - static build assets are cache-first, because they are immutable and
 *     content-hashed by Next
 */

const VERSION = 'rct-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache anything that carries live state or credentials.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/login')
  ) {
    return;
  }

  // Immutable build output: cache-first is safe and fast.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  // Page navigations: always try the network first.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? new Response('Offline', { status: 503 })),
      ),
    );
  }
});
