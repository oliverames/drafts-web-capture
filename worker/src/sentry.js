// Sentry error reporting. Inert until the SENTRY_DSN secret is set, so tests, forks and
// local runs without .dev.vars send nothing. This Worker carries personal captured text,
// so no event may hold anything a user submitted: no request body, headers, cookies,
// query string, IP address or user, and no timezone from the request's cf data.

// Keeps the method and the path of the request URL; drops everything else.
export function beforeSend(event) {
  if (event.request) {
    let url;
    try { const parsed = new URL(event.request.url); url = parsed.origin + parsed.pathname; } catch { url = undefined; }
    event.request = { method: event.request.method, url };
  }
  delete event.user;
  if (event.contexts) delete event.contexts.culture;
  return event;
}

export function sentryOptions(env) {
  return {
    dsn: env.SENTRY_DSN || undefined,
    environment: env.SENTRY_ENVIRONMENT || 'production',
    // SDK 11 replaced sendDefaultPii with dataCollection, which collects everything by default.
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false,
      databaseQueryData: false, stackFrameVariables: false, queues: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
    tracesSampleRate: 0,
    beforeSend,
  };
}
