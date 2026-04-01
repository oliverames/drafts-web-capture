/**
 * Service Worker — Cache-first app shell with background refresh
 *
 * Strategy:
 *  - Precache all app shell assets on install
 *  - Serve from cache immediately (cache-first) for snappy loads
 *  - Revalidate in background so cached assets stay fresh
 *  - Pass through external CDN requests (no caching of third-party scripts)
 *  - Bump CACHE_VERSION whenever assets change to invalidate the old cache
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME    = `drafts-capture-${CACHE_VERSION}`;

const APP_SHELL = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/editor.js',
    '/js/textarea-resize.js',
    '/img/drafts-icon.png',
    '/img/apple-touch-icon.png',
    '/img/favicon-32.png',
];

// ── Install: precache the app shell ───────────────────────────────────────────

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: remove stale caches ────────────────────────────────────────────

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// ── Fetch: cache-first with background revalidation ──────────────────────────

self.addEventListener('fetch', event => {
    const { request } = event;

    // Only intercept GET requests for same-origin assets
    if (request.method !== 'GET') return;
    if (!request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        caches.open(CACHE_NAME).then(async cache => {
            const cached = await cache.match(request);

            // Kick off a background network fetch regardless
            const networkFetch = fetch(request)
                .then(response => {
                    const clone = response.clone();
                    if (response.ok) cache.put(request, clone);
                    return response;
                })
                .catch(() => null);

            // Return cached version immediately if available,
            // otherwise wait for the network
            return cached ?? networkFetch;
        })
    );
});
