// Response helpers shared by every route. No CORS headers are ever set: the app and the
// send API are same-origin, so a cross-origin page has no business reading a response.
export const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  // The PWA loads marked and DOMPurify from jsdelivr and CodeMirror from esm.sh, and uses inline
  // scripts and styles. Everything else is same-origin.
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://esm.sh; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://esm.sh; worker-src 'self'; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
};
export const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', ...extra } });
export function redirect(location, cookies = []) {
  const response = new Response(null, { status: 303, headers: { ...headers, Location: location } });
  for (const value of cookies) response.headers.append('Set-Cookie', value);
  return response;
}
export function withCookies(response, cookies) {
  for (const value of cookies) response.headers.append('Set-Cookie', value);
  return response;
}
