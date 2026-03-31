/**
 * Service Worker — CloudKit API proxy
 *
 * Intercepts ALL requests to api.apple-cloudkit.com and rewrites them
 * to the Cloudflare Worker proxy, which re-sends them with
 * Origin: https://capture.getdrafts.com so the domain-restricted token works.
 */

const PROXY = 'https://drafts-ck-proxy.oliverames.workers.dev';
const CK    = 'https://api.apple-cloudkit.com';

// Activate immediately and claim all open tabs without waiting for reload
self.addEventListener('install',  e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
    if (!event.request.url.startsWith(CK)) return; // let everything else through

    const proxiedUrl = event.request.url.replace(CK, PROXY);
    const proxiedReq = new Request(proxiedUrl, {
        method:      event.request.method,
        headers:     event.request.headers,
        body:        event.request.method !== 'GET' && event.request.method !== 'HEAD'
                         ? event.request.body : undefined,
        credentials: 'omit',
        mode:        'cors',
    });

    event.respondWith(fetch(proxiedReq));
});
