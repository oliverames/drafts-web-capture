// POST /api/send: turns a draft into an email to the user's Drafts Mail Drop address.
// The caller (index.js) has already checked the session and the Origin header.
import { json } from './security.js';

export const FROM = 'Capture <capture@drafts.amesvt.com>';
// Mail Drop addresses live on these domains (the page accepts the same two). Anything
// else is refused so the endpoint cannot relay mail to arbitrary recipients, even with a
// valid session. Both domains belong to Drafts (Agile Tortoise).
export const ALLOWED_DOMAINS = ['drafts.io', 'maildrop.getdrafts.com'];
export const MAX_BODY = 10 * 1024 * 1024;       // whole JSON request, attachments included
export const MAX_CONTENT = 500_000;              // draft text, in characters
export const MAX_ATTACHMENTS = 10;
const LOCAL_PART = /^[A-Za-z0-9._+-]{1,64}$/;

// Only a bare address on the Mail Drop domain: no display name, no list, no whitespace.
export function isMailDropAddress(value) {
  if (typeof value !== 'string' || value.length > 254) return false;
  const parts = value.split('@');
  return parts.length === 2 && LOCAL_PART.test(parts[0]) && ALLOWED_DOMAINS.includes(parts[1].toLowerCase());
}

class BadRequest extends Error { constructor(message, status = 400) { super(message); this.status = status; } }

async function readBody(request) {
  const length = request.headers.get('Content-Length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new BadRequest('The draft is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new BadRequest('Missing draft.');
  const parts = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new BadRequest('The draft is too large.', 413); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new BadRequest('The draft could not be read.'); }
}

function coordinate(value, limit) {
  const number = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number !== 0 && Math.abs(number) <= limit ? number : null;
}

// Validates the request and returns the Resend payload. Throws BadRequest otherwise.
export function buildEmail(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new BadRequest('The draft could not be read.');
  const { email, content, tags, flagged, latitude, longitude, attachments } = data;
  if (typeof email !== 'string' || typeof content !== 'string' || !email || !content.trim()) throw new BadRequest('Missing email or content.');
  if (!isMailDropAddress(email.trim())) throw new BadRequest('The recipient must be a Drafts Mail Drop address.');
  if (content.length > MAX_CONTENT) throw new BadRequest('The draft is too long.', 413);
  if (tags !== undefined && tags !== null && (typeof tags !== 'string' || tags.length > 2000)) throw new BadRequest('The tags could not be read.');

  const lines = content.trim().split('\n');
  let subject = lines[0].replace(/^#+\s*/, '').replace(/[\r\n]+/g, ' ').trim().substring(0, 150);
  let body = lines.slice(1).join('\n');

  const tagList = (tags || '').split(',').map(tag => tag.trim()).filter(Boolean);
  if (tagList.length > 0) subject = `${subject} ${tagList.map(tag => '#' + tag.replace(/\s+/g, '')).join(' ')}`.replace(/[\r\n]+/g, ' ');

  const meta = [];
  if (flagged === true) meta.push('🚩 Flagged');
  const lat = coordinate(latitude, 90), lon = coordinate(longitude, 180);
  if (lat !== null && lon !== null) meta.push(`📍 ${lat}, ${lon}`);
  if (meta.length > 0) body += '\n\n---\n' + meta.join('\n');

  const payload = { from: FROM, to: email.trim(), subject, text: body || ' ' };

  if (attachments !== undefined && attachments !== null) {
    if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS) throw new BadRequest('The attachments could not be read.');
    const files = attachments.flatMap(file => {
      if (!file || typeof file.filename !== 'string' || typeof file.content !== 'string' || !file.filename) throw new BadRequest('An attachment could not be read.');
      if (file.content === '') return []; // an empty file has nothing to forward
      if (file.filename.length > 255 || /[\u0000-\u001f\u007f/\\]/.test(file.filename) || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.content)) throw new BadRequest('An attachment could not be read.');
      return [{ filename: file.filename, content: file.content }];
    });
    if (files.length > 0) payload.attachments = files;
  }
  return payload;
}

export async function send(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('Content-Type') || '')) return json({ error: 'Send the draft as JSON.' }, 415);
  if (!env.RESEND_API_KEY) return json({ error: 'Sending is not configured.' }, 503);
  let payload;
  try { payload = buildEmail(await readBody(request)); }
  catch (error) {
    if (error instanceof BadRequest) return json({ error: error.message }, error.status);
    return json({ error: 'The draft could not be read.' }, 400);
  }
  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
  } catch { return json({ error: 'The mail service could not be reached.' }, 502); }
  // The upstream body can echo the message, so only its status is passed on.
  if (!response.ok) return json({ error: 'The mail service refused the draft.', upstream: response.status }, 502);
  return json({ success: true });
}
