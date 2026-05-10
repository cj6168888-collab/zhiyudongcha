/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'xiaozhi-v2';
const STATIC_CACHE = 'static-v2';
const API_CACHE = 'api-v2';
const IMAGE_CACHE = 'images-v2';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

const CACHE_STRATEGIES = {
  static: 'cache-first',
  api: 'network-first',
  images: 'cache-first',
};

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  (self as ServiceWorkerGlobalScope).skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('xiaozhi-') && name !== CACHE_NAME;
          })
          .map((name) => caches.delete(name))
      );
    })
  );
  (self as ServiceWorkerGlobalScope).clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== location.origin) {
    return;
  }

  const path = url.pathname;
  let strategy = 'network-first';

  if (path.startsWith('/api/')) {
    strategy = CACHE_STRATEGIES.api;
  } else if (path.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)$/)) {
    strategy = CACHE_STRATEGIES.images;
  } else if (path.startsWith('/static/') || path === '/') {
    strategy = CACHE_STRATEGIES.static;
  }

  event.respondWith(handleRequest(request, strategy));
});

async function handleRequest(request: Request, strategy: string): Promise<Response> {
  switch (strategy) {
    case 'cache-first':
      return cacheFirst(request);
    case 'network-first':
      return networkFirst(request);
    default:
      return networkFirst(request);
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(getCacheName(request));
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(getCacheName(request));
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function getCacheName(request: Request): string {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    return API_CACHE;
  }
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|avif)$/)) {
    return IMAGE_CACHE;
  }
  return STATIC_CACHE;
}

export {};
