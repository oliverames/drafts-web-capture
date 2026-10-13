<p align="center">
  <img src="public/img/drafts-icon.png" width="80" height="80" alt="Drafts Web Capture">
</p>

<h1 align="center">Drafts Web Capture</h1>

<p align="center">
  <strong>A private, offline-capable web editor that sends drafts to your Drafts library via Mail Drop, behind a passkey.</strong>
</p>

<p align="center">
  <code>Passkey Sign-in</code> &bull;
  <code>Mail Drop Sync</code> &bull;
  <code>Offline-First</code> &bull;
  <code>Installable PWA</code>
</p>

<p align="center">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-f5a542?style=flat-square" alt="License">
  </a>
  <a href="https://www.buymeacoffee.com/oliverames">
    <img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-f5a542?style=flat-square&logo=buy-me-a-coffee&logoColor=white" alt="Buy Me a Coffee">
  </a>
</p>

---

An unofficial web app that lets you write, tag, and send drafts directly into the [Drafts](https://getdrafts.com) app (by [Agile Tortoise](https://agiletortoise.com)) via Mail Drop. It runs as a single Cloudflare Worker at [drafts.amesvt.com](https://drafts.amesvt.com), and the whole site, the editor and the send API, sits behind the shared AmesVT passkey sign-in.

> **Status:** Personal use. Sending depends on Oliver's Resend account, and only Oliver's passkey identity can sign in. Sign-in is checked on every request, so the app does nothing for anyone else.

## Why This Exists

I wanted a way to write from any computer (especially Windows or Linux machines where the native Drafts app isn't available) and have it sync instantly to my iPhone and iPad.

Drafts features a "Mail Drop" integration, allowing you to send emails to a secret address to create drafts. However, writing emails is clunky. This app acts as an offline-capable Markdown editor that wraps the Mail Drop functionality. You type in a real editor, add tags, and when you hit "Create", the Worker emails the payload to your Mail Drop address.

An endpoint that sends email is a relay if anyone can call it. The first version was open to the world with wildcard CORS and a caller-supplied recipient. This version closes that on two levels: nobody reaches the endpoint without the owner's passkey session, and even with one it only sends to Drafts Mail Drop addresses.

## Quick Start

Run the tests and check that the Worker bundles:

```bash
git clone https://github.com/oliverames/drafts-web-capture.git
cd drafts-web-capture
npm install
npm test
npm run dry-run   # wrangler deploy --dry-run: bundles and lists bindings, uploads nothing
```

The sign-in handoff only works on `drafts.amesvt.com` (the broker's callback is fixed there), so there is no useful local run of the whole app. The tests exercise the Worker with a fake broker and fake assets.

## Core Features

- **Mail Drop Sync:** Writes directly to the Drafts app via your secure Mail Drop address.
- **Offline Queue:** Continue capturing even without an internet connection. Drafts are queued in local storage and submitted when you come back online.
- **Installable PWA:** Add to Home Screen on iOS/Android or install via desktop browsers. App shell is precached for instant loads and full offline access.
- **Dark Mode:** Follows your system preference automatically, with a manual toggle in the footer. Preference is remembered across sessions.
- **Rich Editor:** Powered by CodeMirror 6 with full Markdown syntax highlighting.
- **Write / Preview Toggle:** Switch between writing and a live rendered preview. Supports Markdown, MultiMarkdown, and GitHub Markdown; Plain Text, Taskpaper, and Simple List render as plain text.
- **Multi-Tab Workspace:** Open multiple drafts side-by-side with horizontal tab drag-to-scroll.
- **Tags, Flagged, Location:** Tag chips, a flagged state, and optional GPS coordinates are all sent through to Drafts via the email payload.
- **File Attachments:** Attach files to a draft before sending.
- **Bookmarklet Ready:** Accepts URL parameters (`?text=`, `?tags=`, `?url=`, `?title=`, `?sel=`) for browser extension and bookmarklet integration.

## Architecture

| Layer | Implementation | Description |
|---|---|---|
| **Hosting** | Cloudflare Worker `drafts-capture` | Serves `public/` as static assets and the send API on `https://drafts.amesvt.com` (custom domain, no workers.dev address, no preview URLs) |
| **Sign-in** | AmesVT passkey broker | Service binding `AUTH_BROKER` to worker `amesvt-auth`, entrypoint `DraftsGateway`. Same flow as Calendar Sync and HVAC |
| **Editor** | CodeMirror 6 | Provides Markdown highlighting and text formatting |
| **Transport** | `POST /api/send` | Same-origin, authenticated. Emails the Mail Drop address through the Resend API |
| **Offline** | Service Worker | Cached app shell; drafts queue in local storage while offline or signed out |

```
wrangler.toml          Worker config: assets, custom domain, AUTH_BROKER, rate limit
worker/src/index.js    Routing and gating: every request reaches the Worker first
worker/src/auth.js     Broker client: /login, /auth/callback, logout, session checks
worker/src/send.js     /api/send: validation, recipient rule, Resend call
worker/src/security.js Response headers (no CORS) and helpers
public/                The PWA, plus signed-out.html (the only page served without a session)
test/                  node:test suites with a fake broker, fake assets and a mocked Resend
```

### Access rules

- Every page and asset requires a valid session. The Worker asks the broker to validate the session cookie on each request, so revoking a session centrally takes effect at once.
- Public without a session: `/signed-out`, `/css/styles.css`, `/manifest.json` and the three icons. The manifest is fetched without credentials, so installing the app needs it and its icons to be public. None contain a draft or account data.
- A signed-out navigation gets a `303` to `/login`. A signed-out API call gets `401` JSON.
- Every POST except the broker's `/auth/callback` must carry `Origin: https://drafts.amesvt.com`. There are no CORS headers on any response.
- Cookies are `__Host-drafts` (session, 7 days), `__Host-drafts-flow` (sign-in in progress, 5 minutes) and `__Host-drafts-retry` (one automatic restart, 1 minute), all `Path=/; Secure; HttpOnly; SameSite=Lax`.
- Identity must be Oliver's subject and email with audience `drafts`. Anything else, or a broker that is down or slower than 4 seconds, fails closed with `503`.

### The send endpoint

The Worker takes the first line of your draft (plus any tags formatted as `#hashtags`) as the email Subject and the rest as the Body, then sends it with the [Resend API](https://resend.com) from `Capture <capture@drafts.amesvt.com>`.

- **Recipient rule:** the `email` field must be a single bare address on `drafts.io` or `maildrop.getdrafts.com` (the two Mail Drop domains the page already accepts). Display names, lists, other domains and subdomains are rejected with `400` and nothing is sent. The list is `ALLOWED_DOMAINS` in `worker/src/send.js`.
- **Bounds:** the request body is capped at 10 MB (checked from `Content-Length` and while streaming), draft text at 500,000 characters, and attachments at 10 files.
- **Privacy:** draft content is never logged, and a Resend error body is never echoed back, only its status.

### Offline and expired sessions

Drafts queue in local storage when the network is down. If `/api/send` answers `401` (the session ended), the draft stays queued, the editor is cleared so there is no duplicate, and the page sends you to `/login`. After sign-in you return to `/` and the queue is still there to submit. The service worker never caches `/api/*`, `/login`, `/auth/*` or `/signed-out`, never stores a redirect or sign-in page as the app shell, and serves the cached shell when offline. A bookmarklet link opened while signed out keeps its `text`, `tags`, `url`, `title` and `sel` parameters: a ten-minute `__Host-drafts-return` cookie carries them through sign-in, and the callback returns to `/` with only those parameters. Text longer than about 3,800 encoded characters does not fit in the cookie and is not carried.

## Configuration

| Item | Where | Description |
|---|---|---|
| `RESEND_API_KEY` | Worker secret | A send-only Resend key. Set with `npx wrangler secret put RESEND_API_KEY` |
| `AUTH_BROKER` | `wrangler.toml` | Service binding to `amesvt-auth#DraftsGateway` |
| `LOGIN_LIMIT` | `wrangler.toml` | Rate limit on `/login` and `/auth/callback`, 10 per minute per route per IP. Namespace id `1302` (1301 is HVAC, 1001 to 1003 are other apps) |
| `ASSETS` | `wrangler.toml` | Static assets from `./public`, with `run_worker_first = true` |

Run wrangler from the repository root. The old `worker/` proxy and its separate `wrangler.toml` are gone.

## Deploying and cutover

The Worker replaces both GitHub Pages and the old `drafts-ck-proxy` Worker. Do the steps in this order so the site is never open and the old address keeps working until the new one is verified:

1. Confirm the `DraftsGateway` entrypoint is live in the `amesvt-auth` broker. The deploy fails if the service binding cannot resolve.
2. `npx wrangler secret put RESEND_API_KEY` for `drafts-capture`. The existing key lives on `drafts-ck-proxy` and is copied over here. Wrangler offers to create the Worker when it does not exist yet; accept, and step 4 deploys the real code over it.
3. Remove the DNS CNAME `drafts` to `oliverames.github.io` and disable GitHub Pages for this repository. The Worker's custom domain cannot attach while that record exists, and the `public/CNAME` file is gone because the Worker, not Pages, serves the domain.
4. `npm run deploy` (`wrangler deploy`). This attaches the `drafts.amesvt.com` custom domain.
5. Verify: `curl -I https://drafts.amesvt.com/` returns `303` to `/login`, `/signed-out` loads, signing in with the passkey lands on the editor, and sending a draft arrives in Drafts.
6. Delete the old `drafts-ck-proxy` Worker (`npx wrangler delete --name drafts-ck-proxy`).

The GitHub Pages deploy workflow was removed with this change, so merging does not redeploy Pages.

## Building / Development

1. Make your changes in the `public/` directory (vanilla HTML/CSS/JS) or `worker/src/`.
2. `npm test` runs the Worker and service worker suites (`node --test`).
3. `npm run dry-run` confirms the Worker bundles and shows its bindings.
4. If you change anything in `public/` that the app shell uses, bump `CACHE_VERSION` in `public/sw.js`.

---

<p align="center">
  <a href="https://www.buymeacoffee.com/oliverames">
    <img src="https://img.shields.io/badge/Buy_Me_a_Coffee-support-f5a542?style=for-the-badge&logo=buy-me-a-coffee&logoColor=white" alt="Buy Me a Coffee">
  </a>
</p>

<p align="center">
  <sub>
    Built by <a href="https://ames.consulting">Oliver Ames</a> in Vermont
    &bull; <a href="https://github.com/oliverames">GitHub</a>
    &bull; <a href="https://linkedin.com/in/oliverames">LinkedIn</a>
    &bull; <a href="https://bsky.app/profile/oliverames.bsky.social">Bluesky</a>
  </sub>
</p>
