// Sign-in through the shared AmesVT passkey broker at login.amesvt.com, ported from the
// Calendar Sync Worker (outlook-google-sync worker/src/auth.js) and the HVAC dashboard
// (hvac-dispatch-engine src/web/auth.ts). One central passkey sign-in hands off to this
// app silently. The broker's private DraftsGateway entrypoint fixes the audience and the
// callback URL, so browser sign-in only works on drafts.amesvt.com.
const enc = new TextEncoder();
export const APP_ORIGIN = 'https://drafts.amesvt.com';
export const BROKER_ORIGIN = 'https://login.amesvt.com';
const OWNER_ID = 'vSN-A-11wMQ9KATr-o5HLkc7E1H8BxVmB_GXaJ7BJcs';
const OWNER_EMAIL = 'oliverames@gmail.com';
const AUDIENCE = 'drafts';
export const APP_COOKIE = '__Host-drafts';
const FLOW_COOKIE = '__Host-drafts-flow';
const RETRY_COOKIE = '__Host-drafts-retry';
const FLOW_MS = 5 * 60 * 1000;
export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const BROKER_TIMEOUT_MS = 4000;
// Canonical base64url encoding of 32 random bytes (including its final pad bits).
const TOKEN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;

export class AuthError extends Error { constructor(status) { super('Authentication unavailable'); this.status = status; } }
const cookie = (name, value, age) => `${name}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
export const clearFlow = () => cookie(FLOW_COOKIE, '', 0);
export const clearApp = () => cookie(APP_COOKIE, '', 0);
const base64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const random = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
const sha256 = async value => base64url(await crypto.subtle.digest('SHA-256', enc.encode(value)));
function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) return false;
  let mismatch = 0; for (let index = 0; index < left.length; index++) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
// Returns the cookie's value, or null when it is absent or sent more than once.
export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  if (header.length > 8192) return null;
  const values = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  return values.length === 1 ? values[0].slice(name.length + 1) : null;
}
function readFlow(request) {
  const value = readCookie(request, FLOW_COOKIE);
  try {
    if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const bytes = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), ch => ch.charCodeAt(0));
    if (base64url(bytes) !== value) throw new Error();
    const flow = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!flow || Array.isArray(flow) || Object.keys(flow).sort().join(',') !== 'expiresAt,state,verifier' || !TOKEN.test(flow.state) || !TOKEN.test(flow.verifier) || !Number.isSafeInteger(flow.expiresAt) || flow.expiresAt <= Date.now() || flow.expiresAt > Date.now() + FLOW_MS) throw new Error();
    return flow;
  } catch { throw new AuthError(400); }
}
async function boundedBody(request) {
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 4096)) throw new AuthError(400);
  const reader = request.body?.getReader(); if (!reader) return '';
  let size = 0, text = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); throw new AuthError(400); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch { throw new AuthError(400); } finally { reader.releaseLock(); }
}
function brokerMethod(env, name) {
  const binding = env.AUTH_BROKER;
  if (!binding || typeof binding[name] !== 'function') throw new AuthError(503);
  // Workerd RPC methods are callable proxies; reading .bind would invoke remote RPC.
  return (...args) => binding[name](...args);
}
async function brokerCall(env, name, ...args) {
  let timeout;
  try {
    const call = Promise.resolve().then(() => brokerMethod(env, name)(...args));
    call.catch(() => {}); // a late rejection after the timeout must not go unhandled
    return await Promise.race([
      call,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new AuthError(503)), BROKER_TIMEOUT_MS); }),
    ]);
  } catch { throw new AuthError(503); } finally { clearTimeout(timeout); }
}

// Returns the redirect target and cookies. The caller applies its own rate limit.
export async function login(request, env, url) {
  if (request.method !== 'GET') throw new AuthError(405);
  if (url.search) throw new AuthError(400);
  const flow = { state: random(), verifier: random(), expiresAt: Date.now() + FLOW_MS };
  const transaction = await brokerCall(env, 'createTransaction', { state: flow.state, pkceChallenge: await sha256(flow.verifier) });
  if (!transaction || !TOKEN.test(transaction.transactionId)) throw new AuthError(503);
  return { location: `${BROKER_ORIGIN}/?transaction=${transaction.transactionId}`, cookies: [cookie(FLOW_COOKIE, base64url(enc.encode(JSON.stringify(flow))), FLOW_MS / 1000)] };
}
// A handoff can outlive this browser's five-minute flow, for example after an emailed
// setup link. Start one fresh sign-in instead of a dead end; the broker hands back
// without another passkey prompt. A second failure within a minute shows the error.
function restartSignIn(request) {
  if (readCookie(request, RETRY_COOKIE)) throw new AuthError(400);
  return { location: '/login', cookies: [clearFlow(), cookie(RETRY_COOKIE, '1', 60)] };
}
// The broker returns either by redirect (GET with code and state in the query, when the
// central sign-in is already current) or by form post after a passkey prompt. Both are
// bound to this browser's flow state and PKCE verifier, and the code is one-use.
export async function callback(request, env, url) {
  let fields, code, state, flow;
  if (request.method === 'GET') {
    if (/%(?![a-f0-9]{2})/i.test(url.search)) throw new AuthError(400);
    fields = [...url.searchParams.keys()].sort();
    code = url.searchParams.get('code'); state = url.searchParams.get('state');
    if (fields.join(',') !== 'code,state' || !TOKEN.test(code) || !TOKEN.test(state)) throw new AuthError(400);
    try { flow = readFlow(request); } catch { return restartSignIn(request); }
  } else {
    if (request.method !== 'POST') throw new AuthError(405);
    if (request.headers.get('Origin') !== BROKER_ORIGIN) throw new AuthError(403);
    if (url.search) throw new AuthError(400);
    if (!/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('Content-Type') || '')) throw new AuthError(400);
    try { flow = readFlow(request); } catch { return restartSignIn(request); }
    const raw = await boundedBody(request);
    // URLSearchParams is permissive about malformed escapes; reject them explicitly.
    if (/%(?![a-f0-9]{2})/i.test(raw)) throw new AuthError(400);
    const input = new URLSearchParams(raw); fields = [...input.keys()].sort();
    code = input.get('code'); state = input.get('state');
    if (fields.join(',') !== 'code,state' || !TOKEN.test(code) || !TOKEN.test(state)) throw new AuthError(400);
  }
  if (!safeEqual(state, flow.state)) return restartSignIn(request);
  const result = await brokerCall(env, 'redeemHandoff', { code, state, verifier: flow.verifier });
  const now = Date.now();
  if (!result || !TOKEN.test(result.appSessionToken) || !Number.isSafeInteger(result.expiresAt) || result.expiresAt <= now || result.expiresAt > now + SESSION_MS) throw new AuthError(503);
  const age = Math.floor((result.expiresAt - now) / 1000);
  if (age < 1) throw new AuthError(503);
  return { location: '/', cookies: [clearFlow(), cookie(RETRY_COOKIE, '', 0), cookie(APP_COOKIE, result.appSessionToken, age)] };
}
// Signing out here ends the central sign-in too, as on the other AmesVT apps.
export async function logout(request, env) {
  const session = readCookie(request, APP_COOKIE);
  if (!TOKEN.test(session)) return;
  const result = await brokerCall(env, 'logoutAppSession', session);
  if (!result || result.ok !== true) throw new AuthError(503);
}
// Every protected request rechecks the broker, so central revocation applies at once.
export async function authenticated(request, env) {
  brokerMethod(env, 'validateAppSession');
  const session = readCookie(request, APP_COOKIE);
  if (!TOKEN.test(session)) return false;
  const identity = await brokerCall(env, 'validateAppSession', session);
  if (identity === null) return false;
  const now = Date.now();
  if (!identity || identity.subject !== OWNER_ID || identity.email !== OWNER_EMAIL || identity.audience !== AUDIENCE || !Number.isSafeInteger(identity.authTime) || !Number.isSafeInteger(identity.expiresAt) || identity.authTime <= 0 || identity.authTime > now || identity.expiresAt <= now || identity.expiresAt > identity.authTime + SESSION_MS) throw new AuthError(503);
  return true;
}
