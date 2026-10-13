/**
 * Service Worker - offline app shell behind the AmesVT passkey sign-in
 *
 * Strategy:
 *  - Precache the app shell on install (signed in, so the requests carry the session)
 *  - Navigations: network first, so an expired session reaches the Worker and is sent to
 *    /login; fall back to the cached shell when offline, slow, or the server errors
 *  - Other same-origin GETs: cached copy first, refreshed in the background
 *  - Never touch /api/*, /login, /auth/* or /signed-out: those always go to the network
 *    and are never cached, so no authenticated response or sign-in redirect is stored
 *  - Only cache plain 200 responses for this origin. A 303 to /login (an opaque redirect)
 *    or a sign-in page reached through a redirect is passed to the browser, not cached
 *  - Bump CACHE_VERSION whenever assets change to invalidate the old cache
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME    = `drafts-capture-${CACHE_VERSION}`;
const NAV_TIMEOUT_MS = 4000;

const APP_SHELL = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/editor.js',
    '/js/textarea-resize.js',
    '/manifest.json',
    '/img/drafts-icon.png',
    '/img/apple-touch-icon.png',
    '/img/favicon-32.png',
];

// Routes the service worker must leave to the network.
const isNetworkOnly = path =>
    path.startsWith('/api/') || path === '/login' || path.startsWith('/auth/') || path === '/signed-out';

// A response that is safe to keep: a successful, same-origin answer that was not reached
// through a redirect (a sign-in page or an error page must never become the app shell).
const cacheable = response =>
    response && response.ok && response.status === 200 && response.type === 'basic' && !response.redirected;

// ── Install: precache the app shell ───────────────────────────────────────────

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.all(APP_SHELL.map(async path => {
                const response = await fetch(new Request(new URL(path, self.location.origin), { cache: 'reload', credentials: 'same-origin' }));
                if (!cacheable(response)) throw new Error(`Not cacheable: ${path}`);
                await cache.put(path, response);
            })))
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

// ── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
    const { request } = event;

    if (request.method !== 'GET') return;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;
    if (isNetworkOnly(url.pathname)) return;

    if (request.mode === 'navigate') {
        event.respondWith(navigate(request, url));
        return;
    }
    event.respondWith(assetRequest(request));
});

// The shell is one page, whatever the query string (bookmarklet links add ?text=).
async function navigate(request, url) {
    const cache = await caches.open(CACHE_NAME);
    const shell = () => cache.match('/');
    const isShell = url.pathname === '/' || url.pathname === '/index.html';
    try {
        let timer;
        const response = await Promise.race([
            fetch(request),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('slow')), NAV_TIMEOUT_MS); }),
        ]).finally(() => clearTimeout(timer));
        // 303 to /login arrives as an opaque redirect: hand it to the browser untouched.
        if (response.type === 'opaqueredirect' || response.redirected) return response;
        if (isShell && cacheable(response)) cache.put('/', response.clone());
        if (response.status >= 500 && isShell) return (await shell()) || response;
        return response;
    } catch {
        return (isShell && await shell()) || Response.error();
    }
}

async function assetRequest(request) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    // Kick off a background network fetch regardless
    const networkFetch = fetch(request)
        .then(response => {
            if (cacheable(response)) cache.put(request, response.clone());
            return response;
        })
        .catch(() => null);

    // Return the cached version immediately if there is one, otherwise wait for the network
    return cached ?? (await networkFetch) ?? Response.error();
}
