/**
 * Cloudflare Worker — CloudKit API proxy
 *
 * Intercepts requests from oliverames.github.io and re-issues them
 * to api.apple-cloudkit.com with Origin: https://capture.getdrafts.com
 * so the domain-restricted token is accepted.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    // Rewrite path to Apple's API
    url.hostname = 'api.apple-cloudkit.com';
    url.protocol = 'https:';
    url.port = '';

    const headers = new Headers(request.headers);
    headers.set('Origin', 'https://capture.getdrafts.com');
    headers.set('Referer', 'https://capture.getdrafts.com/');
    // Remove CF-specific headers that Apple doesn't want
    headers.delete('CF-Connecting-IP');
    headers.delete('CF-Ray');
    headers.delete('CF-Visitor');

    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.arrayBuffer();
    }

    const upstream = new Request(url.toString(), {
      method: request.method,
      headers,
      body,
    });

    const response = await fetch(upstream);

    // Forward response with CORS headers appended
    const responseHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS)) {
      responseHeaders.set(k, v);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  },
};
