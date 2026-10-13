// Shared fakes for the Worker tests: a fake AUTH_BROKER service binding, a fake ASSETS
// binding, and small request helpers. The Worker code runs unmodified under Node.
import worker from '../../worker/src/index.js';

export const ORIGIN = 'https://drafts.amesvt.com';
export const BROKER = 'https://login.amesvt.com';
export const OWNER = 'vSN-A-11wMQ9KATr-o5HLkc7E1H8BxVmB_GXaJ7BJcs';
// A valid broker token: 43 characters whose last one is a canonical base64url pad character.
export const tok = char => char.repeat(42) + 'A';
export const SESSION = tok('S');

export const identity = (over = {}) => ({ subject: OWNER, email: 'oliverames@gmail.com', audience: 'drafts', authTime: Date.now() - 1000, expiresAt: Date.now() + 3600_000, ...over });

export const FILES = {
  '/index.html': ['<html>app</html>', 'text/html; charset=utf-8'],
  '/signed-out.html': ['<html>signed out</html>', 'text/html; charset=utf-8'],
  '/css/styles.css': ['body{}', 'text/css'],
  '/js/app.js': ['console.log(1)', 'text/javascript'],
  '/sw.js': ['// sw', 'text/javascript'],
  '/manifest.json': ['{}', 'application/json'],
  '/img/favicon-32.png': ['png', 'image/png'],
  '/img/apple-touch-icon.png': ['png', 'image/png'],
  '/img/drafts-icon.png': ['png', 'image/png'],
};

export function makeEnv(over = {}) {
  const calls = { assets: [], broker: [] };
  const record = (name, result) => async (...args) => { calls.broker.push([name, ...args]); return typeof result === 'function' ? result(...args) : result; };
  const env = {
    calls,
    RESEND_API_KEY: 're_test_key',
    ASSETS: {
      async fetch(request) {
        const path = new URL(request.url).pathname;
        calls.assets.push(path);
        const file = FILES[path];
        return file ? new Response(file[0], { headers: { 'Content-Type': file[1], ETag: '"x"' } }) : new Response('Not found', { status: 404 });
      },
    },
    AUTH_BROKER: {
      createTransaction: record('createTransaction', { transactionId: tok('T') }),
      redeemHandoff: record('redeemHandoff', () => ({ appSessionToken: tok('K'), expiresAt: Date.now() + 3600_000 })),
      validateAppSession: record('validateAppSession', () => identity()),
      logoutAppSession: record('logoutAppSession', { ok: true }),
    },
    ...over,
  };
  return env;
}

// Replace one broker method with a custom implementation.
export const withBroker = (env, name, impl) => { env.AUTH_BROKER[name] = async (...args) => { env.calls.broker.push([name, ...args]); return impl(...args); }; return env; };

export function request(path, { method = 'GET', headers = {}, body, session = false, cookies = [], origin } = {}) {
  const all = { ...headers };
  const jar = [...cookies]; if (session) jar.push(`__Host-drafts=${session === true ? SESSION : session}`);
  if (jar.length) all.Cookie = jar.join('; ');
  if (origin) all.Origin = origin;
  return new Request(ORIGIN + path, { method, headers: all, body });
}
export const call = (env, req) => worker.fetch(req, env);
export const send = (env, path, options) => call(env, request(path, options));

export function setCookies(response) { return response.headers.getSetCookie(); }
export const cookieValue = (response, name) => setCookies(response).map(c => c.split(';')[0]).find(c => c.startsWith(name + '='))?.slice(name.length + 1);
export const form = fields => ({ method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() });

// Start a sign-in and return the flow cookie and the state the Worker chose.
export async function startFlow(env) {
  const response = await send(env, '/login');
  const flow = cookieValue(response, '__Host-drafts-flow');
  const { state } = JSON.parse(Buffer.from(flow, 'base64url').toString());
  return { response, flowCookie: `__Host-drafts-flow=${flow}`, state };
}
