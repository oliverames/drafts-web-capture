/**
 * Service Worker — Standard cache (no longer proxying CloudKit)
 */
self.addEventListener('install',  e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    // Basic pass-through
    return;
});
