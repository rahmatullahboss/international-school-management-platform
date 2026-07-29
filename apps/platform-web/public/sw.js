/* global self, caches, fetch, URL */

const CACHE_PREFIX = 'school-platform-exp-01';
const SHELL_CACHE = `${CACHE_PREFIX}-shell-v1`;
const ASSET_CACHE = `${CACHE_PREFIX}-assets-v1`;
const SHELL_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/school-platform-192.svg',
  '/icons/school-platform-512.svg',
];
const NEVER_CACHE_PATHS = ['/api/', '/auth/', '/documents/download/', '/reports/jobs/', '/logout'];

function isSensitiveRequest(url) {
  return NEVER_CACHE_PATHS.some((path) => url.pathname.startsWith(path));
}

function responseCanBeCached(response) {
  if (!response.ok || (response.type !== 'basic' && response.type !== 'default')) return false;
  const cacheControl = response.headers.get('cache-control') ?? '';
  return !/(?:no-store|private)/iu.test(cacheControl);
}

async function cacheShellAssets() {
  const cache = await caches.open(SHELL_CACHE);
  await Promise.all(
    SHELL_ASSETS.map(async (asset) => {
      const response = await fetch(asset, { cache: 'reload' });
      if (responseCanBeCached(response)) await cache.put(asset, response);
    }),
  );

  const shell = await cache.match('/');
  if (shell === undefined) return;
  const html = await shell.text();
  const assetPaths = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/gu)].map(
    (match) => match[1],
  );
  await Promise.all(
    assetPaths.map(async (asset) => {
      if (asset === undefined) return;
      const response = await fetch(asset, { cache: 'reload' });
      if (responseCanBeCached(response)) await cache.put(asset, response);
    }),
  );
}

async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const shell = await caches.match('/');
    if (shell !== undefined) return shell;
    const offline = await caches.match('/offline.html');
    if (offline !== undefined) return offline;
    throw new Error('OFFLINE_SHELL_UNAVAILABLE');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (responseCanBeCached(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? network;
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheShellAssets());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith(CACHE_PREFIX) && key !== SHELL_CACHE && key !== ASSET_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isSensitiveRequest(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
