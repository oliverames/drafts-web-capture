// drafts-capture: serves the Drafts Capture PWA and its send API at https://drafts.amesvt.com,
// entirely behind the shared AmesVT passkey broker (login.amesvt.com). The static files in
// public/ are bound as ASSETS with run_worker_first, so every request reaches this Worker.
import { APP_ORIGIN, AuthError, authenticated, callback, clearApp, clearFlow, login, logout } from './auth.js';
import { headers, json, redirect, withCookies } from './security.js';
import { send } from './send.js';

// The signed-out page and what it and the installed app need before any sign-in. The web
// app manifest is fetched without credentials, so it and its icons cannot sit behind the
// session. None of these contain a draft or any account data.
const PUBLIC_ASSETS = {
  '/signed-out': '/signed-out.html',
  '/css/styles.css': '/css/styles.css',
  '/manifest.json': '/manifest.json',
  '/img/favicon-32.png': '/img/favicon-32.png',
  '/img/apple-touch-icon.png': '/img/apple-touch-icon.png',
  '/img/drafts-icon.png': '/img/drafts-icon.png',
};

async function asset(env, request, path, status) {
  const file = await env.ASSETS.fetch(new Request(new URL(path, request.url), { method: 'GET' }));
  const response = new Response(request.method === 'HEAD' ? null : file.body, { status: status ?? file.status, headers: file.headers });
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

// Sign-in depends on the broker. When it fails, show the signed-out page (which links
// back to /login to retry) instead of a bare error.
async function signInProblem(env, request, status) {
  const response = await asset(env, request, '/signed-out.html', status);
  response.headers.set('X-Sign-In-Problem', String(status));
  return response;
}

// Throttles the two unauthenticated sign-in routes per IP when the binding exists.
async function throttle(request, env, route) {
  if (!env.LOGIN_LIMIT) return;
  let allowed = true;
  try { allowed = (await env.LOGIN_LIMIT.limit({ key: `${route}:${request.headers.get('CF-Connecting-IP') || 'unknown'}` })).success; } catch { /* never lock the owner out on a limiter fault */ }
  if (!allowed) throw new AuthError(429);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (url.origin !== APP_ORIGIN) return json({ error: 'Unknown host.' }, 404);
    if (!['GET', 'HEAD', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, HEAD, POST' });
    try {
      if (path === '/login' || path === '/auth/callback') {
        await throttle(request, env, path === '/login' ? 'login' : 'callback');
        const { location, cookies } = path === '/login' ? await login(request, env, url) : await callback(request, env, url);
        return redirect(location, cookies);
      }
      // Every other POST comes from this site's own pages.
      if (request.method === 'POST' && request.headers.get('Origin') !== APP_ORIGIN) return json({ error: 'Cross-site request refused.' }, 403);
      if (path === '/auth/logout') {
        if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
        await logout(request, env);
        return withCookies(json({ ok: true, next: '/signed-out' }), [clearApp(), clearFlow()]);
      }
      if (PUBLIC_ASSETS[path] && request.method !== 'POST') return asset(env, request, PUBLIC_ASSETS[path]);

      const api = path.startsWith('/api/');
      if (!(await authenticated(request, env))) {
        // A current central sign-in hands back from /login without a passkey prompt.
        if (api || (request.method !== 'GET' && request.method !== 'HEAD')) return withCookies(json({ error: 'Please sign in again.' }, 401), [clearApp()]);
        return redirect('/login', [clearApp()]);
      }
      if (api) return path === '/api/send' ? send(request, env) : json({ error: 'Not found.' }, 404);
      if (request.method === 'POST') return json({ error: 'Not found.' }, 404);
      return asset(env, request, path === '/' ? '/index.html' : path);
    } catch (error) {
      if (!(error instanceof AuthError)) throw error;
      const cookies = path === '/auth/callback' ? [clearFlow()] : [];
      if (path.startsWith('/api/') || path === '/auth/logout') return withCookies(json({ error: error.status === 429 ? 'Too many tries. Wait a minute, then try again.' : 'Sign-in is temporarily unavailable.' }, error.status), cookies);
      return withCookies(await signInProblem(env, request, error.status), cookies);
    }
  },
};
