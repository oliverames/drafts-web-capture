// Runs public/sw.js in a vm with a fake Cache API to check what it will and will not cache.
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://drafts.amesvt.com';
const path = key => (typeof key === 'string' ? new URL(key, ORIGIN) : new URL(key.url)).pathname;
const page = (over = {}) => ({ ok: true, status: 200, type: 'basic', redirected: false, clone() { return this; }, body: 'shell', ...over });
const opaqueRedirect = { ok: false, status: 0, type: 'opaqueredirect', redirected: false, clone() { return this; } };

function load(fetchImpl, seeded = {}) {
  const listeners = {}, store = new Map(Object.entries(seeded)), deleted = [];
  const cache = { put: async (key, response) => { store.set(path(key), response); }, match: async key => store.get(path(key)) };
  const context = {
    self: { addEventListener: (type, fn) => { listeners[type] = fn; }, location: { origin: ORIGIN }, skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, keys: async () => ['drafts-capture-v1', 'drafts-capture-v2', 'other'], delete: async key => { deleted.push(key); } },
    fetch: (...args) => fetchImpl(...args), Request, Response, URL, setTimeout, clearTimeout, Promise,
  };
  vm.runInNewContext(CODE, context);
  const dispatch = request => {
    let responded; listeners.fetch({ request, respondWith: promise => { responded = promise; } });
    return responded;
  };
  const nav = (p, over) => dispatch({ method: 'GET', mode: 'navigate', url: ORIGIN + p, ...over });
  const asset = (p, over) => dispatch({ method: 'GET', mode: 'no-cors', url: ORIGIN + p, ...over });
  return { listeners, store, deleted, nav, asset, dispatch, context };
}

test('the cache version is bumped from v1', () => {
  const sw = load(async () => page());
  assert.equal(vm.runInContext('CACHE_NAME', sw.context), 'drafts-capture-v2');
});

test('activate removes the old cache but keeps the current one', async () => {
  const sw = load(async () => page());
  let done; sw.listeners.activate({ waitUntil: promise => { done = promise; } });
  await done;
  assert.deepEqual(sw.deleted.sort(), ['drafts-capture-v1', 'other']);
});

test('API, sign-in and signed-out routes are never intercepted', () => {
  const sw = load(async () => { throw new Error('should not fetch'); });
  for (const p of ['/api/send', '/api/anything', '/login', '/auth/callback', '/auth/logout', '/signed-out']) {
    assert.equal(sw.nav(p), undefined, p);
    assert.equal(sw.asset(p), undefined, p);
  }
  assert.equal(sw.dispatch({ method: 'POST', mode: 'cors', url: ORIGIN + '/api/send' }), undefined);
  assert.equal(sw.dispatch({ method: 'GET', mode: 'cors', url: 'https://esm.sh/@codemirror/view@6' }), undefined);
  assert.deepEqual([...sw.store.keys()], []);
});

test('install precaches the shell, and fails rather than cache a sign-in redirect', async () => {
  const good = load(async () => page());
  let done; good.listeners.install({ waitUntil: promise => { done = promise; } });
  await done;
  assert.ok(good.store.has('/') && good.store.has('/js/app.js') && good.store.has('/manifest.json'));

  const redirected = load(async () => page({ redirected: true, type: 'basic' }));
  redirected.listeners.install({ waitUntil: promise => { done = promise; } });
  await assert.rejects(done);
  assert.equal(redirected.store.size, 0);
});

test('a signed-out navigation (303 to /login) goes to the browser and is not cached', async () => {
  const sw = load(async () => opaqueRedirect);
  const response = await sw.nav('/');
  assert.equal(response, opaqueRedirect);
  assert.equal(sw.store.size, 0);
});

test('a navigation that ended on a sign-in page through a redirect is not cached as the shell', async () => {
  const login = page({ redirected: true, type: 'cors', body: 'login' });
  const sw = load(async () => login, { '/': page({ body: 'old shell' }) });
  assert.equal(await sw.nav('/'), login);
  assert.equal(sw.store.get('/').body, 'old shell');
});

test('a good navigation refreshes the cached shell; a query string still maps to the shell', async () => {
  const fresh = page({ body: 'fresh shell' });
  const sw = load(async () => fresh, { '/': page({ body: 'old shell' }) });
  assert.equal(await sw.nav('/?text=hello'), fresh);
  assert.equal(sw.store.get('/').body, 'fresh shell');
});

test('offline, the cached shell is served for navigations, including bookmarklet URLs', async () => {
  const sw = load(async () => { throw new TypeError('offline'); }, { '/': page({ body: 'cached shell' }) });
  assert.equal((await sw.nav('/')).body, 'cached shell');
  assert.equal((await sw.nav('/?text=hello&tags=x')).body, 'cached shell');
  assert.equal((await sw.nav('/index.html')).body, 'cached shell');
});

test('a server error or broker outage on the shell falls back to the cached shell', async () => {
  const sw = load(async () => page({ ok: false, status: 503 }), { '/': page({ body: 'cached shell' }) });
  assert.equal((await sw.nav('/')).body, 'cached shell');
  assert.equal(sw.store.get('/').body, 'cached shell');
});

test('assets are served from cache and refreshed, and sign-in redirects are never stored', async () => {
  const sw = load(async () => page({ body: 'new js' }), { '/js/app.js': page({ body: 'cached js' }) });
  assert.equal((await sw.asset('/js/app.js')).body, 'cached js');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sw.store.get('/js/app.js').body, 'new js');

  const signedOut = load(async () => page({ redirected: true, type: 'cors' }));
  await signedOut.asset('/js/app.js');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(signedOut.store.size, 0);

  const offline = load(async () => { throw new TypeError('offline'); }, { '/css/styles.css': page({ body: 'css' }) });
  assert.equal((await offline.asset('/css/styles.css')).body, 'css');
});
