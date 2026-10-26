import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { BROKER, FILES, ORIGIN, OWNER, SESSION, call, cookieValue, form, identity, makeEnv, request, send, setCookies, startFlow, tok, withBroker } from './support/harness.js';
import { beforeSend, sentryOptions } from '../worker/src/sentry.js';

afterEach(() => mock.restoreAll());

const ACAO = response => [...response.headers.keys()].filter(key => key.toLowerCase().startsWith('access-control-'));
const location = response => response.headers.get('Location');

describe('gating', () => {
  test('anonymous page request is sent to /login with a 303', async () => {
    const env = makeEnv();
    const response = await send(env, '/');
    assert.equal(response.status, 303);
    assert.equal(location(response), '/login');
    assert.equal(env.calls.assets.length, 0);
    assert.match(setCookies(response).join('\n'), /__Host-drafts=; Path=\/; Max-Age=0; Secure; HttpOnly; SameSite=Lax/);
  });

  test('every private asset, unknown path and HEAD request needs a session', async () => {
    const env = makeEnv();
    for (const path of ['/index.html', '/js/app.js', '/js/editor.js', '/sw.js', '/CNAME', '/nothing/here', '/robots.txt']) {
      const response = await send(env, path);
      assert.equal(response.status, 303, path);
      assert.equal(location(response), '/login', path);
    }
    assert.equal((await send(env, '/', { method: 'HEAD' })).status, 303);
    assert.equal(env.calls.assets.length, 0, 'ASSETS is never read without a session');
  });

  test('anonymous API requests get 401 JSON, not a redirect', async () => {
    const env = makeEnv();
    for (const options of [{ method: 'GET' }, { method: 'POST', origin: ORIGIN, headers: { 'Content-Type': 'application/json' }, body: '{}' }]) {
      const response = await send(env, '/api/send', options);
      assert.equal(response.status, 401);
      assert.match(response.headers.get('Content-Type'), /application\/json/);
      assert.deepEqual(await response.json(), { error: 'Please sign in again.' });
    }
  });

  test('only the signed-out page, stylesheet, manifest and icons are public', async () => {
    const env = makeEnv();
    for (const path of ['/signed-out', '/css/styles.css', '/manifest.json', '/img/favicon-32.png', '/img/apple-touch-icon.png', '/img/drafts-icon.png']) {
      const response = await send(env, path);
      assert.equal(response.status, 200, path);
    }
    assert.deepEqual(env.calls.assets, ['/signed-out.html', '/css/styles.css', '/manifest.json', '/img/favicon-32.png', '/img/apple-touch-icon.png', '/img/drafts-icon.png']);
    assert.equal(await (await send(env, '/signed-out')).text(), FILES['/signed-out.html'][0]);
  });

  test('a signed-in request reads the shell and assets from ASSETS with security headers', async () => {
    const env = makeEnv();
    const page = await send(env, '/', { session: true });
    assert.equal(page.status, 200);
    assert.equal(await page.text(), FILES['/index.html'][0]);
    assert.equal(page.headers.get('Cache-Control'), 'no-store');
    assert.equal(page.headers.get('X-Frame-Options'), 'DENY');
    assert.match(page.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    assert.equal(page.headers.get('Content-Type'), 'text/html; charset=utf-8');
    assert.equal((await send(env, '/js/app.js', { session: true })).status, 200);
    assert.equal((await send(env, '/sw.js', { session: true })).status, 200);
    assert.equal((await send(env, '/missing.js', { session: true })).status, 404);
    const head = await send(env, '/', { session: true, method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.deepEqual(env.calls.assets.slice(0, 3), ['/index.html', '/js/app.js', '/sw.js']);
  });

  test('requests for another host or method are refused', async () => {
    const env = makeEnv();
    assert.equal((await call(env, new Request('https://drafts-capture.example.workers.dev/', { headers: { Cookie: `__Host-drafts=${SESSION}` } }))).status, 404);
    assert.equal((await send(env, '/', { method: 'DELETE', session: true })).status, 405);
    const options = await send(env, '/api/send', { method: 'OPTIONS', origin: 'https://evil.example', headers: { 'Access-Control-Request-Method': 'POST' } });
    assert.equal(options.status, 405);
    assert.deepEqual(ACAO(options), []);
  });

  test('a stale, unknown or foreign-audience session is not signed in', async () => {
    const env = makeEnv();
    withBroker(env, 'validateAppSession', () => null);
    assert.equal((await send(env, '/', { session: true })).status, 303);
    assert.equal((await send(env, '/', { session: 'not-a-token' })).status, 303);
    // A malformed token never reaches the broker.
    assert.equal(env.calls.broker.filter(([name]) => name === 'validateAppSession').length, 1);
  });
});

describe('login', () => {
  test('GET /login starts a broker transaction and redirects to login.amesvt.com', async () => {
    const env = makeEnv();
    const { response, state } = await startFlow(env);
    assert.equal(response.status, 303);
    assert.equal(location(response), `${BROKER}/?transaction=${tok('T')}`);
    const [name, args] = env.calls.broker[0];
    assert.equal(name, 'createTransaction');
    assert.equal(args.state, state);
    assert.match(args.pkceChallenge, /^[A-Za-z0-9_-]{43}$/);
    const flow = setCookies(response).find(c => c.startsWith('__Host-drafts-flow='));
    assert.match(flow, /; Path=\/; Max-Age=300; Secure; HttpOnly; SameSite=Lax$/);
  });

  test('login rejects query strings and other methods', async () => {
    const env = makeEnv();
    assert.equal((await send(env, '/login?next=/x')).status, 400);
    assert.equal((await send(env, '/login', { method: 'POST', origin: ORIGIN })).status, 405);
    assert.equal(env.calls.broker.length, 0);
  });

  test('a broker that is down, slow or returns junk fails closed with 503', async () => {
    const down = makeEnv(); withBroker(down, 'createTransaction', () => { throw new Error('boom'); });
    assert.equal((await send(down, '/login')).status, 503);
    const junk = makeEnv(); withBroker(junk, 'createTransaction', () => ({ transactionId: 'short' }));
    assert.equal((await send(junk, '/login')).status, 503);
    const missing = makeEnv({ AUTH_BROKER: undefined });
    assert.equal((await send(missing, '/login')).status, 503);
    assert.equal((await send(missing, '/', { session: true })).status, 503);
    assert.equal((await send(missing, '/api/send', { session: true })).status, 503);
  });

  test('a broker that does not answer in four seconds is a 503', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    const env = makeEnv(); withBroker(env, 'validateAppSession', () => new Promise(() => {}));
    const pending = send(env, '/', { session: true });
    let response; pending.then(value => { response = value; });
    for (let i = 0; i < 100 && !response; i++) { await new Promise(resolve => setImmediate(resolve)); mock.timers.tick(4000); }
    assert.equal(response?.status, 503);
    assert.equal(response.headers.get('X-Sign-In-Problem'), '503');
  });

  test('/login and /auth/callback are rate limited per route and IP', async () => {
    const keys = [];
    const env = makeEnv({ LOGIN_LIMIT: { limit: async ({ key }) => { keys.push(key); return { success: key.startsWith('callback:') ? false : true }; } } });
    assert.equal((await send(env, '/login', { headers: { 'CF-Connecting-IP': '203.0.113.9' } })).status, 303);
    const limited = await send(env, `/auth/callback?code=${tok('C')}&state=${tok('Q')}`, { headers: { 'CF-Connecting-IP': '203.0.113.9' } });
    assert.equal(limited.status, 429);
    assert.deepEqual(keys, ['login:203.0.113.9', 'callback:203.0.113.9']);
  });
});

describe('auth callback', () => {
  test('a POST that does not come from login.amesvt.com is refused with 403', async () => {
    const env = makeEnv();
    const { flowCookie, state } = await startFlow(env);
    for (const origin of [undefined, ORIGIN, 'https://evil.example', 'https://login.amesvt.com.evil.example']) {
      const response = await send(env, '/auth/callback', { ...form({ code: tok('C'), state }), origin, cookies: [flowCookie] });
      assert.equal(response.status, 403, String(origin));
    }
    assert.equal(env.calls.broker.filter(([name]) => name === 'redeemHandoff').length, 0);
  });

  test('the redirect handoff (GET with code and state) signs in and lands on /', async () => {
    const env = makeEnv();
    const { flowCookie, state } = await startFlow(env);
    const response = await send(env, `/auth/callback?code=${tok('C')}&state=${state}`, { cookies: [flowCookie] });
    assert.equal(response.status, 303);
    assert.equal(location(response), '/');
    const cookies = setCookies(response);
    assert.ok(cookies.some(c => /^__Host-drafts=K{42}A; Path=\/; Max-Age=\d+; Secure; HttpOnly; SameSite=Lax$/.test(c)), cookies.join('\n'));
    assert.ok(cookies.some(c => c.startsWith('__Host-drafts-flow=; ') && c.includes('Max-Age=0')));
    const redeem = env.calls.broker.find(([name]) => name === 'redeemHandoff');
    assert.deepEqual(Object.keys(redeem[1]).sort(), ['code', 'state', 'verifier']);
    assert.equal(redeem[1].state, state);
    // The pkce challenge sent at /login is the SHA-256 of the verifier redeemed here.
    const { createHash } = await import('node:crypto');
    const challenge = env.calls.broker.find(([name]) => name === 'createTransaction')[1].pkceChallenge;
    assert.equal(createHash('sha256').update(redeem[1].verifier).digest('base64url'), challenge);
  });

  test('the form POST handoff from the broker signs in', async () => {
    const env = makeEnv();
    const { flowCookie, state } = await startFlow(env);
    const response = await send(env, '/auth/callback', { ...form({ code: tok('C'), state }), origin: BROKER, cookies: [flowCookie] });
    assert.equal(response.status, 303);
    assert.equal(location(response), '/');
    assert.ok(cookieValue(response, '__Host-drafts'));
  });

  test('the session cookie it sets works on the next request', async () => {
    const env = makeEnv();
    const { flowCookie, state } = await startFlow(env);
    const signedIn = await send(env, `/auth/callback?code=${tok('C')}&state=${state}`, { cookies: [flowCookie] });
    const page = await send(env, '/', { session: cookieValue(signedIn, '__Host-drafts') });
    assert.equal(page.status, 200);
    assert.equal(env.calls.broker.at(-1)[1], tok('K'));
  });

  test('a signed-out bookmarklet visit keeps its text through sign-in', async () => {
    const env = makeEnv();
    const text = 'Notes; with "quotes", commas, % signs & emoji \u{1F4DD}\nline two';
    const visit = await send(env, `/?text=${encodeURIComponent(text)}&tags=inbox&evil=1`);
    assert.equal(location(visit), '/login');
    const carried = setCookies(visit).find(c => c.startsWith('__Host-drafts-return='));
    assert.match(carried, /; Path=\/; Max-Age=600; Secure; HttpOnly; SameSite=Lax$/);
    const value = carried.split(';')[0].slice('__Host-drafts-return='.length);
    assert.match(value, /^[A-Za-z0-9%*._+=&-]+$/, 'only cookie-safe characters');
    const { flowCookie, state } = await startFlow(env);
    const response = await send(env, `/auth/callback?code=${tok('C')}&state=${state}`, { cookies: [flowCookie, `__Host-drafts-return=${value}`] });
    const back = new URL(location(response), ORIGIN);
    assert.equal(back.pathname, '/');
    assert.equal(back.searchParams.get('text'), text);
    assert.equal(back.searchParams.get('tags'), 'inbox');
    assert.equal(back.searchParams.has('evil'), false);
    assert.ok(setCookies(response).some(c => c.startsWith('__Host-drafts-return=; ') && c.includes('Max-Age=0')));
  });

  test('the return cookie only ever leads back to / with bookmarklet parameters', async () => {
    const env = makeEnv();
    for (const path of ['/js/app.js?text=x', '/?nothing=here', '/']) {
      assert.equal(setCookies(await send(env, path)).some(c => c.startsWith('__Host-drafts-return=')), false, path);
    }
    assert.equal(setCookies(await send(env, '/?text=x', { method: 'HEAD' })).some(c => c.startsWith('__Host-drafts-return=')), false);
    const long = await send(env, `/?text=${'a'.repeat(4000)}`);
    assert.equal(setCookies(long).some(c => c.startsWith('__Host-drafts-return=')), false, 'text too long for a cookie is not carried');
    for (const forged of ['//evil.example', 'https%3A%2F%2Fevil.example', 'next=//evil.example']) {
      const { flowCookie, state } = await startFlow(env);
      const response = await send(env, `/auth/callback?code=${tok('C')}&state=${state}`, { cookies: [flowCookie, `__Host-drafts-return=${forged}`] });
      assert.equal(location(response), '/', forged);
    }
  });

  test('a stale or missing flow restarts sign-in once, then stops', async () => {
    const env = makeEnv();
    const url = `/auth/callback?code=${tok('C')}&state=${tok('Q')}`;
    const first = await send(env, url);
    assert.equal(first.status, 303);
    assert.equal(location(first), '/login');
    assert.ok(setCookies(first).some(c => /^__Host-drafts-retry=1; Path=\/; Max-Age=60; Secure; HttpOnly; SameSite=Lax$/.test(c)));
    const second = await send(env, url, { cookies: ['__Host-drafts-retry=1'] });
    assert.equal(second.status, 400);
    assert.equal(env.calls.broker.filter(([name]) => name === 'redeemHandoff').length, 0);
  });

  test('a state that does not match this browser\'s flow restarts sign-in', async () => {
    const env = makeEnv();
    const { flowCookie } = await startFlow(env);
    const response = await send(env, `/auth/callback?code=${tok('C')}&state=${tok('Q')}`, { cookies: [flowCookie] });
    assert.equal(response.status, 303);
    assert.equal(location(response), '/login');
  });

  test('extra, missing or malformed parameters are rejected', async () => {
    const env = makeEnv();
    const { flowCookie, state } = await startFlow(env);
    for (const query of [`code=${tok('C')}&state=${state}&x=1`, `code=${tok('C')}`, `code=short&state=${state}`, `code=${tok('C')}&state=${state}%zz`, '']) {
      const response = await send(env, `/auth/callback${query ? '?' + query : ''}`, { cookies: [flowCookie] });
      assert.equal(response.status, 400, query);
    }
  });

  test('an identity that is not Oliver, or not for this app, is a 503 and no session is kept', async () => {
    for (const bad of [{ subject: 'someone-else' }, { email: 'other@example.com' }, { audience: 'calendar-sync' }, { audience: undefined }, { expiresAt: Date.now() - 1 }, { authTime: Date.now() + 60_000 }, { expiresAt: Date.now() + 8 * 24 * 3600_000 }]) {
      const env = makeEnv();
      withBroker(env, 'validateAppSession', () => identity(bad));
      const page = await send(env, '/', { session: true });
      assert.equal(page.status, 503, JSON.stringify(bad));
      assert.equal(env.calls.assets.filter(path => path === '/index.html').length, 0);
      const api = await send(env, '/api/send', { session: true, method: 'POST', origin: ORIGIN, headers: { 'Content-Type': 'application/json' }, body: '{}' });
      assert.equal(api.status, 503);
    }
  });

  test('a redeemed session with a bad token or a lifetime over seven days is refused', async () => {
    for (const result of [{ appSessionToken: 'bad', expiresAt: Date.now() + 1000 }, { appSessionToken: tok('K'), expiresAt: Date.now() + 8 * 24 * 3600_000 }, { appSessionToken: tok('K'), expiresAt: Date.now() - 1 }, null]) {
      const env = makeEnv();
      const { flowCookie, state } = await startFlow(env);
      withBroker(env, 'redeemHandoff', () => result);
      const response = await send(env, `/auth/callback?code=${tok('C')}&state=${state}`, { cookies: [flowCookie] });
      assert.equal(response.status, 503);
      assert.equal(cookieValue(response, '__Host-drafts'), undefined);
    }
  });
});

describe('logout', () => {
  test('POST /auth/logout ends the broker session and clears the cookies', async () => {
    const env = makeEnv();
    const response = await send(env, '/auth/logout', { method: 'POST', origin: ORIGIN, session: true });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, next: '/signed-out' });
    assert.deepEqual(env.calls.broker.find(([name]) => name === 'logoutAppSession'), ['logoutAppSession', SESSION]);
    const cookies = setCookies(response).join('\n');
    assert.match(cookies, /__Host-drafts=; Path=\/; Max-Age=0/);
    assert.match(cookies, /__Host-drafts-flow=; Path=\/; Max-Age=0/);
  });

  test('logout from another origin is refused and GET is not allowed', async () => {
    const env = makeEnv();
    assert.equal((await send(env, '/auth/logout', { method: 'POST', origin: 'https://evil.example', session: true })).status, 403);
    assert.equal((await send(env, '/auth/logout', { method: 'POST', session: true })).status, 403);
    assert.equal((await send(env, '/auth/logout', { session: true })).status, 405);
    assert.equal(env.calls.broker.filter(([name]) => name === 'logoutAppSession').length, 0);
  });

  test('a broker failure during logout is reported, not hidden', async () => {
    const env = makeEnv(); withBroker(env, 'logoutAppSession', () => ({ ok: false }));
    assert.equal((await send(env, '/auth/logout', { method: 'POST', origin: ORIGIN, session: true })).status, 503);
  });
});

describe('POST /api/send', () => {
  const draft = (over = {}) => ({ email: 'drafts-abc123@drafts.io', content: '# Title line\nBody text\nmore', ...over });
  const post = (env, body, options = {}) => send(env, '/api/send', {
    method: 'POST', session: true, origin: ORIGIN, headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body), ...options,
  });
  const resend = (respond = () => new Response('{"id":"e1"}', { status: 200 })) => {
    const calls = [];
    mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url: String(url), init }); return respond(url, init); });
    return calls;
  };

  test('requires a session', async () => {
    const calls = resend();
    const response = await post(makeEnv(), draft(), { session: false });
    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });

  test('rejects POSTs from another origin or with no Origin', async () => {
    const calls = resend();
    for (const origin of ['https://evil.example', 'https://drafts.amesvt.com.evil.example', 'http://drafts.amesvt.com', undefined]) {
      const response = await post(makeEnv(), draft(), { origin });
      assert.equal(response.status, 403, String(origin));
      assert.deepEqual(ACAO(response), []);
    }
    assert.equal(calls.length, 0);
  });

  test('refuses any recipient that is not a Mail Drop address', async () => {
    const calls = resend();
    const bad = [
      'someone@example.com', 'oliver@amesvt.com', 'a@sub.drafts.io', 'a@drafts.io.evil.com', 'a@evil.com.drafts.io.evil.com',
      'a@drafts.io, b@example.com', 'a@drafts.io;b@example.com', 'a@drafts.io\nBcc: b@example.com', '"x" <a@drafts.io>', 'Name <a@drafts.io>',
      'b@example.com@drafts.io', '@drafts.io', 'drafts.io', '', ' ', 'a b@drafts.io', 'a@@drafts.io', 'a@drafts.io\u0000', 'a@maildrop.getdrafts.com.evil.com',
    ];
    for (const email of bad) {
      const response = await post(makeEnv(), draft({ email }));
      assert.equal(response.status, 400, JSON.stringify(email));
    }
    for (const email of [['a@drafts.io'], { a: 1 }, 7, null, true]) assert.equal((await post(makeEnv(), draft({ email }))).status, 400);
    assert.equal(calls.length, 0, 'Resend is never called for a bad recipient');
    // Surrounding whitespace from the input box is trimmed, nothing else is.
    assert.equal((await post(makeEnv(), draft({ email: ' drafts-abc123@drafts.io ' }))).status, 200);
    assert.equal(JSON.parse(calls[0].init.body).to, 'drafts-abc123@drafts.io');
  });

  test('accepts Mail Drop addresses on drafts.io and maildrop.getdrafts.com', async () => {
    const calls = resend();
    for (const email of ['drafts-abc123@drafts.io', 'DRAFTS-abc@DRAFTS.IO', 'drafts-abc123@maildrop.getdrafts.com']) assert.equal((await post(makeEnv(), draft({ email }))).status, 200, email);
    assert.equal(calls.length, 3);
  });

  test('sends one email through Resend with the right shape and no CORS headers', async () => {
    const calls = resend();
    const response = await post(makeEnv(), draft({ tags: 'work, big idea', flagged: true, latitude: 44.26, longitude: -72.57, syntax: 'Markdown', attachments: [{ filename: 'note.txt', content: 'aGVsbG8=' }] }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.deepEqual(ACAO(response), []);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test_key');
    assert.equal(calls[0].init.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      from: 'Capture <capture@drafts.amesvt.com>',
      to: 'drafts-abc123@drafts.io',
      subject: 'Title line #work #bigidea',
      text: 'Body text\nmore\n\n---\n🚩 Flagged\n📍 44.26, -72.57',
      attachments: [{ filename: 'note.txt', content: 'aGVsbG8=' }],
    });
  });

  test('a plain draft has no metadata block and a one-line draft still has a body', async () => {
    const calls = resend();
    await post(makeEnv(), draft({ content: 'Just a title', latitude: 0, longitude: 0, flagged: false, attachments: [] }));
    assert.deepEqual(JSON.parse(calls[0].init.body), { from: 'Capture <capture@drafts.amesvt.com>', to: 'drafts-abc123@drafts.io', subject: 'Just a title', text: ' ' });
  });

  test('subject lines cannot be used to inject headers', async () => {
    const calls = resend();
    await post(makeEnv(), draft({ content: 'Hi\r\nBcc: x@example.com\nbody', tags: 'a\r\nBcc: y@example.com' }));
    assert.doesNotMatch(JSON.parse(calls[0].init.body).subject, /[\r\n]/);
  });

  test('rejects bodies that are not JSON, too large, or malformed', async () => {
    const calls = resend();
    const env = makeEnv();
    assert.equal((await post(env, 'email=a@drafts.io', { headers: { 'Content-Type': 'text/plain' } })).status, 415);
    assert.equal((await post(env, '{not json')).status, 400);
    assert.equal((await post(env, '[]')).status, 400);
    assert.equal((await post(env, draft({ content: '   ' }))).status, 400);
    assert.equal((await post(env, draft({ content: 'x'.repeat(500_001) }))).status, 413);
    assert.equal((await post(env, draft({ tags: 12 }))).status, 400);
    assert.equal((await post(env, draft({ attachments: 'nope' }))).status, 400);
    assert.equal((await post(env, draft({ attachments: [{ filename: '../x', content: 'aGk=' }] }))).status, 400);
    assert.equal((await post(env, draft({ attachments: [{ filename: 'x', content: 'not base64!' }] }))).status, 400);
    assert.equal((await post(env, draft({ attachments: Array.from({ length: 11 }, () => ({ filename: 'a', content: 'aGk=' })) }))).status, 400);
    assert.equal(calls.length, 0);
  });

  test('bounds the request body by Content-Length and by what is actually streamed', async () => {
    const calls = resend();
    const env = makeEnv();
    const declared = await post(env, draft(), { headers: { 'Content-Type': 'application/json', 'Content-Length': String(11 * 1024 * 1024) } });
    assert.equal(declared.status, 413);
    const big = JSON.stringify(draft({ attachments: [{ filename: 'big.bin', content: 'A'.repeat(10 * 1024 * 1024 + 1) }] }));
    const streamed = await post(env, big);
    assert.equal(streamed.status, 413);
    assert.equal(calls.length, 0);
  });

  test('GET /api/send is not allowed and unknown API routes are 404', async () => {
    resend();
    assert.equal((await send(makeEnv(), '/api/send', { session: true })).status, 405);
    assert.equal((await send(makeEnv(), '/api/other', { session: true })).status, 404);
  });

  test('a Resend failure is a 502 that does not echo the upstream body', async () => {
    resend(() => new Response('{"message":"secret draft text and details"}', { status: 422 }));
    const response = await post(makeEnv(), draft());
    assert.equal(response.status, 502);
    const text = await response.text();
    assert.doesNotMatch(text, /secret draft text/);
    assert.deepEqual(JSON.parse(text), { error: 'The mail service refused the draft.', upstream: 422 });
  });

  test('a network failure to Resend is a 502, and a missing key a 503', async () => {
    resend(() => { throw new TypeError('network'); });
    assert.equal((await post(makeEnv(), draft())).status, 502);
    const calls = resend();
    assert.equal((await post(makeEnv({ RESEND_API_KEY: undefined }), draft())).status, 503);
    assert.equal(calls.length, 0);
  });

  test('draft content is never written to the logs', async () => {
    resend();
    const seen = [];
    for (const level of ['log', 'info', 'warn', 'error', 'debug']) mock.method(console, level, (...args) => { seen.push(args.join(' ')); });
    await post(makeEnv(), draft({ content: 'TOP SECRET DRAFT' }));
    await post(makeEnv(), draft({ email: 'x@example.com', content: 'TOP SECRET DRAFT' }));
    assert.deepEqual(seen, []);
  });
});

describe('security headers', () => {
  test('no response sets a CORS header', async () => {
    const env = makeEnv();
    const responses = [await send(env, '/'), await send(env, '/signed-out'), await send(env, '/', { session: true }), await send(env, '/login'), await send(env, '/api/send', { origin: 'https://evil.example', headers: { Origin: 'https://evil.example' } })];
    for (const response of responses) assert.deepEqual(ACAO(response), []);
  });

  test('identity constants are the owner\'s', () => { assert.equal(OWNER, 'vSN-A-11wMQ9KATr-o5HLkc7E1H8BxVmB_GXaJ7BJcs'); });
});

describe('sentry', () => {
  test('is off without a DSN and never sends PII or traces', () => {
    const options = sentryOptions({});
    assert.equal(options.dsn, undefined);
    assert.equal(options.dataCollection.userInfo, false);
    assert.equal(options.dataCollection.cookies, false);
    assert.equal(options.dataCollection.httpHeaders, false);
    assert.deepEqual(options.dataCollection.httpBodies, []);
    assert.equal(options.dataCollection.urlQueryParams, false);
    assert.equal(options.tracesSampleRate, 0);
    assert.equal(options.environment, 'production');
  });

  test('beforeSend keeps only the request method and path', () => {
    const event = beforeSend({
      request: { method: 'POST', url: 'https://drafts.amesvt.com/api/send?draft=TOP+SECRET', data: '{"content":"TOP SECRET DRAFT"}', headers: { Cookie: '__Host-drafts=x' }, cookies: { '__Host-drafts': 'x' }, query_string: 'draft=TOP+SECRET', env: { REMOTE_ADDR: '203.0.113.9' } },
      user: { ip_address: '203.0.113.9', email: 'oliverames@gmail.com' },
      contexts: { culture: { timezone: 'America/New_York' }, cloud_resource: { 'cloud.provider': 'cloudflare' } },
    });
    assert.deepEqual(event.request, { method: 'POST', url: 'https://drafts.amesvt.com/api/send' });
    assert.equal(event.user, undefined);
    assert.deepEqual(event.contexts, { cloud_resource: { 'cloud.provider': 'cloudflare' } });
    assert.doesNotMatch(JSON.stringify(event), /SECRET|203\.0\.113|oliverames|__Host-drafts/);
  });
});
