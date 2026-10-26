# Worklog

## 2026-10-26 - Sentry error reporting (not deployed)

**What changed**:
- The Worker export is wrapped with `Sentry.withSentry` from `@sentry/cloudflare` 11.9.0 (pinned exactly). Options live in `worker/src/sentry.js`: the DSN comes from the `SENTRY_DSN` secret, so the SDK is inert until it is set; `dataCollection` with every field off (SDK 11 removed `sendDefaultPii`, and `dataCollection` collects everything by default); `tracesSampleRate: 0`; environment `production` unless `SENTRY_ENVIRONMENT` says otherwise.
- `beforeSend` keeps only the request method and the URL without its query string. It drops the request body, headers, cookies, query string and env, the user, and the culture context (the timezone from `request.cf`). Captured drafts never reach Sentry.
- `wrangler.toml` adds `compatibility_flags = ["nodejs_compat"]`, which the SDK needs for AsyncLocalStorage, and a `CF_VERSION_METADATA` binding, which the SDK reports as the release.
- Two tests cover the options and `beforeSend`.

**Verification**: `npm test` passed 53 of 53, and `npm run dry-run` bundled and listed the new `CF_VERSION_METADATA` binding. Under `wrangler dev` with the DSN in `.dev.vars`, a temporary throwing route (removed before commit) received a POST carrying a JSON body, a cookie, a custom header, a query string and `CF-Connecting-IP`. Sentry event `5a53cc9937d64aeea30afa7c0514b824` arrived with environment `development` and a release, and its request had no body, headers, cookies or query; user IP was empty and none of the marker strings appeared anywhere in the event.

**Left off at**: Not deployed. Production needs two steps, in order:
1. `op read 'op://Development/Drafts Web Capture Sentry DSN/credential' | npx wrangler secret put SENTRY_DSN`
2. `npm run deploy`

**Open questions**: Sentry still attached a city-level `user.geo` derived server-side from the sending IP (here, the Mac). In production the sender is the Cloudflare data center, usually near the user. Turning on "Prevent Storing of IP Addresses" in the Sentry project's security settings should stop that; it was not changed here.

---

## 2026-10-23 - Security review: sanitized Markdown preview

**What changed**:
- The Markdown preview passed `marked` output straight into the page, and `marked` keeps raw HTML. A crafted `/?text=` link or a captured selection containing `<img src=x onerror=...>` ran script on drafts.amesvt.com once Preview was pressed, with access to the queued drafts and the Mail Drop address. The preview now runs through DOMPurify 3.4.16 and falls back to plain text if DOMPurify did not load.
- `marked` was loaded as `marked@9` with no integrity check, so any new 9.x release would run here. It is now pinned to 9.1.6, and both CDN scripts carry SRI hashes checked against jsDelivr and unpkg.
- The service worker cache is now v4 so installed copies pick up the new `app.js`.
- Removed the unused `playwright` dependency, `.env.example` (settings for the retired password and Tailscale server) and a `.gitignore` comment about the removed CloudKit `config.js`.

**Verification**: `npm test` passed 51 of 51. A jsdom check with the pinned `marked` and DOMPurify showed `onerror`, `<script>`, `<iframe>` and `javascript:` links removed while headings, emphasis and https links stayed. The lockfile diff removes only `playwright`, `playwright-core` and `fsevents`.

**Left off at**: Not deployed. The fix reaches drafts.amesvt.com after `npm run deploy`.

**Open questions**: None.

---

## 2026-10-13 - Bookmarklet text survives sign-in; capture.amesvt.com is permanent

**What changed**:
- [PR 4](https://github.com/oliverames/drafts-web-capture/pull/4) fixes [#2](https://github.com/oliverames/drafts-web-capture/issues/2). A signed-out visit to `/?text=...` stores the bookmarklet parameters (`text`, `tags`, `url`, `title`, `sel`) in a ten-minute `__Host-drafts-return` cookie. The sign-in callback returns to `/` with only those parameters.
- Text containing a bare `%` no longer throws in `handleUrlParameters()` and stops the app from starting.
- The service worker cache is now v3.
- For [#3](https://github.com/oliverames/drafts-web-capture/issues/3), the Cloudflare redirect for capture.amesvt.com is now a 301 to drafts.amesvt.com that keeps the path and query. Its DNS record was changed from the retired `oliverames.github.io` CNAME to a proxied `AAAA 100::` placeholder.

**Decisions made**: The return target is always `/`, so the cookie cannot redirect anywhere else. Text longer than about 3,800 encoded characters does not fit in a cookie and is not carried; the README notes the limit.

**Verification**: `npm test` passed 51 of 51, and `wrangler deploy --dry-run` succeeded. The Worker was deployed as version `e03902b1`. Live, `/?text=hello%20world&evil=1` returned a 303 to `/login` and set `__Host-drafts-return=text=hello+world`. `capture.amesvt.com/?text=hi` returned a 301 to `https://drafts.amesvt.com/?text=hi`.

**Left off at**: Still open: Oliver signs in once and sends a test draft.

**Open questions**: None.

---

## 2026-10-13 - Move to one Worker behind the AmesVT passkey

**What changed**: Replaced the GitHub Pages site plus the separate `drafts-ck-proxy` Worker with a single Cloudflare Worker, `drafts-capture`, that serves the PWA and the send API at https://drafts.amesvt.com entirely behind the shared AmesVT passkey broker (`amesvt-auth`, entrypoint `DraftsGateway`, audience `drafts`), mirroring Calendar Sync and HVAC. Nothing is deployed yet.

- `wrangler.toml` at the repo root: `[assets]` from `./public` with `run_worker_first`, custom domain route, `workers_dev = false`, `preview_urls = false`, `AUTH_BROKER` service binding, and a `LOGIN_LIMIT` rate limit (namespace 1302).
- `worker/src/auth.js` is the Calendar Sync broker client ported to the drafts audience and cookies (`__Host-drafts`, `-flow`, `-retry`). The callback takes the redirect GET and the broker's form POST. Identity is checked on every request and fails closed.
- `worker/src/index.js` gates every request. Public without a session: `/signed-out`, the stylesheet, the manifest and icons (the manifest is fetched without credentials). Signed-out navigations get 303 to `/login`, signed-out API calls get 401 JSON, and POSTs need `Origin: https://drafts.amesvt.com`. No CORS headers anywhere.
- `worker/src/send.js` is the old proxy logic at `POST /api/send`. It now refuses any recipient that is not a bare Mail Drop address, bounds the body (10 MB) and draft text, strips line breaks from the subject, never logs content and never echoes the Resend error body.
- PWA: `app.js` posts to same-origin `/api/send`. On 401 the draft stays queued, the editor clears to avoid a duplicate, and the page goes to `/login`. Added a Sign out button. `sw.js` (cache `v2`) never caches `/api/*`, `/login`, `/auth/*`, `/signed-out`, never stores redirects or sign-in pages, uses network-first navigations with the cached shell as the offline fallback, and keeps the shell under one key for `?text=` bookmarklet URLs.
- Added `public/signed-out.html` in the existing sign-in card style, a `.btn-link` button style, tests (`npm test`, 49 tests with a fake broker, fake assets and mocked Resend, plus a vm-based service worker suite), and removed `worker/index.js`, `worker/wrangler.toml`, `public/CNAME` and the GitHub Pages workflow. `.wrangler/` is now untracked and ignored.

**Decisions made**:
- The recipient rule allows `drafts.io` and `maildrop.getdrafts.com`, not only `drafts.io`, because the page's own address check already accepts both and rejecting the second would silently break an address on it. One list in `send.js` (`ALLOWED_DOMAINS`) if that should narrow.
- Navigations are network-first, not cache-first, so an expired session reaches the Worker and is sent to `/login`. Cached shell on offline, a 4 second stall, or a 5xx.
- CSP allows `'unsafe-inline'` scripts and styles plus jsdelivr and esm.sh, because the page uses inline scripts and loads marked and CodeMirror from them. Checked in a browser against a stub broker: the editor mounts.
- `sw.js` stays behind the session. A service worker update check made while signed out just fails and keeps the old worker.

**Cutover order (not done)**: (1) `DraftsGateway` live in the broker, (2) `npx wrangler secret put RESEND_API_KEY` on `drafts-capture`, (3) remove the DNS CNAME `drafts` to `oliverames.github.io` and disable GitHub Pages, (4) `npm run deploy`, (5) verify (303 to `/login` when signed out, passkey sign-in, send a draft), (6) delete the old `drafts-ck-proxy` Worker.

**Left off at**: Branch `claude/amesvt-passkey` pushed, no PR. Known gap: a bookmarklet link opened while signed out loses its `?text=` parameters in the sign-in round trip. The service worker was tested in Node with a fake Cache API only; the embedded browser used for the visual check does not register service workers. Carried open items from earlier entries untouched.

**Open questions**: None.

---
## 2026-06-22 — Security: scrubbed leaked Resend + CloudKit secrets from git history

**What changed**: A security audit of all public repos found two real secrets in this repo's history. (1) Resend API key `re_i2ikDujd…` in `test-resend.js` (commit 4b4377db, 2026-03-31) — the file was already deleted from HEAD but lived in 2 commits; this was the CURRENT production send-only key. (2) CloudKit web token `f65019e2…` in `public/js/cloudkit.js` (commit 954c84c8) — removed from HEAD but live in 6 commits. Rewrote all 40 commits with `git-filter-repo --replace-text` (both secrets → placeholders) and force-pushed `main`. HEAD content is byte-identical (secrets were not in HEAD); only ancestor blobs changed. No tags on this repo. Verified 0 occurrences across all history from a fresh clone (gitleaks: 0 findings).

**Decisions made**:
- Rotate-then-scrub, because scrubbing history does not un-expose an already-public key. The Resend key was rotated (new send-only key in 1P `Resend.com`, old key revoked 401) and the CloudKit token flagged for manual regeneration (no rotation API). Critical catch: the Resend key was ALSO the SMTP password in Gmail Send-mail-as for oliver@amesvt.com (`smtp.resend.com:465`), updated there too; inbound is Cloudflare Email Routing and was never affected.
- Ran filter-repo with `GIT_CONFIG_GLOBAL=/dev/null` — the global `alias.cleanup-preview` has an embedded newline that crashes filter-repo's config parser.

**Left off at**: Secrets scrubbed + Resend rotated/verified. CloudKit token regeneration still pending (Apple Reminder set). Carried open items from 2026-04-01 untouched (editable Mail Drop address without losing queue; More dropdown keyboard navigation).

**Open questions**: None new.

---

## 2026-04-01 — Format bar responsive overhaul, mobile UX, editor padding

**What changed**: Full rework of the format bar for responsive behavior and mobile usability, plus iOS-specific fixes.

- **Format bar responsive layout**: Secondary buttons (# " • 1. — Link Image) now render inline on desktop as a `.fmt-extended-group`. On mobile (≤680px) that group hides and a `.fmt-more-group` (pinned outside the scrollable `#fmt-btns` container) shows instead. More button is a flex sibling of `#fmt-btns` in `.format-bar-mid` — not inside it — so it stays pinned right regardless of button scroll.
- **More dropdown opens upward**: Changed from `top: calc(100% + 4px)` to `bottom: calc(100% + 4px)` so the menu opens above the format bar, not into the meta/flag row below.
- **HIG 44pt touch targets**: More button is now `height: 44px`; format bar `min-height: 44px`. "More" label kept visible at all breakpoints — removing it left only a tiny `▾` glyph that was nearly impossible to tap.
- **iOS Safari zoom fix**: `#draft-content` and `.cm-content` set to `font-size: 16px` on mobile. iOS zooms on any input with computed size < 16px; this stops it without touching `user-scalable`.
- **Equal editor padding**: Changed from asymmetric `22px 22px 16px` to `20px` uniform in both `editor.js` (CM6 theme) and `styles.css` (textarea + preview pane).
- **Button contrast**: `.fmt-btn` color bumped from `--ink-3` to `--ink-2`; `.fmt-more-btn` from `--ink-4` to `--ink-3`.
- **Desktop editor height**: Reduced to 90% of available viewport (multiplied computed height by 0.9).
- **Multi-iteration fix**: Three screenshot-check rounds were needed to get mobile right — More button was initially inside the scrollable container (scrolled off), then too small (24px), then "More" label hidden by existing 480px rule. Each caught and fixed in sequence.

**Decisions made**:
- More button moved to `fmtMid.appendChild(moreGroup)` rather than `container.appendChild(moreGroup)` — essential so it doesn't scroll with the buttons. Required cleanup of stale moreGroup on each `renderFormatButtons` call via `fmtMid.querySelectorAll('.fmt-more-group').forEach(el => el.remove())`.
- `mdLine` items (# " •) moved from always-inline to the extended/More group. On 390px, B I S ` + More already fills the bar — adding 3 more inline buttons caused clipping with no way to reach them.
- Removed separator before More button (was eating 7px, causing `` ` `` to clip at 390px). "More ▾" label provides sufficient visual separation.
- `.format-bar-mid` changed from `overflow: hidden` to `overflow: visible` — necessary for the absolute-positioned dropdown to escape, and for the More button (outside `#fmt-btns`) to not be clipped.
- HIG-compliant 44pt touch target: referenced Apple HIG which specifies 44×44pt minimum for iOS/iPadOS interactive elements.

**Left off at**:
- Still open: allow editing the Mail Drop address without losing queue
- Still open: More dropdown keyboard navigation (arrow keys)
- Still open: Should `clearAllTabs` queue tab content before clearing?
- New: dividers (fmt-sep) in format bar — user asked what they're for; kept for now but user may want them removed (confirmed they group inline/line/extended button sets)

**Open questions**:
- Still open: Add DOMPurify if the app ever becomes multi-user.

---

## 2026-04-01 — PWA support, dark mode toggle, accessibility contrast fixes

**What changed**: Full PWA implementation, dark mode with manual toggle, and a round of accessibility contrast fixes. All committed and pushed to live.

- **PWA**: `manifest.json` created with all icon sizes. Service worker rewritten from pass-through stub to cache-first with background revalidation — precaches all 9 app shell assets on install, purges stale caches on activate. `viewport-fit=cover` + `env(safe-area-inset-bottom)` for iPhone notch/home indicator. `100dvh` instead of `100vh` for correct height in mobile browsers. Tested with Playwright: SW activates, all assets cached, offline reload confirmed working.
- **Dark mode**: `@media (prefers-color-scheme: dark)` replaced with `html.dark` class selectors throughout. No-FOUC init script in `<head>` sets the class from localStorage (or system pref fallback) before the stylesheet parses. Theme toggle (sun/moon icon) added to footer nav — icon state owned by CSS selectors, not JS. `theme-color` meta updated on toggle for PWA chrome/Safari. System preference changes tracked while page is open via `matchMedia` listener.
- **Accessibility**: `.help-link`, `.btn-sign-out`, `.btn-theme-toggle` bumped from `--ink-4` (#8e8e93, 2.88:1) to `--ink-3` (#636366, ~5.2:1) — passes WCAG AA.
- **Code cleanup (simplify pass)**: merged duplicate `@media (pointer: coarse)` blocks; consolidated `body { min-height }` into main body rule; SW `response.clone()` moved before conditional to prevent latent body-stream locking; stale implementation comment removed.

**Decisions made**:
- Dark mode uses `html.dark` class (JS-owned) rather than `@media (prefers-color-scheme: dark)` to support the manual toggle without duplicating the entire CSS block.
- Icon visibility (sun/moon) is CSS-driven (`html.dark .icon-sun { display:none }`), not JS-driven — eliminates `syncIcon()` and its redundant DOM reads.
- SW background revalidation kept despite efficiency agent's note — it's intentional stale-while-revalidate; cache invalidation is via `CACHE_VERSION` bump on deploy.
- Dark mode alert colors NOT changed despite accessibility agent's suggestion — recalculated against actual composited backgrounds (semi-transparent over `#000000`) and all pass easily (~8.6:1 success, ~5.6:1 info). Agent had calculated against wrong background.
- Ran Playwright SW test before documenting PWA support in README (caught a documentation-without-testing gap).

**Left off at**: All three "Still open" PWA/dark mode items from previous entries are resolved. Remaining:
- Still open: allow editing the Mail Drop address without losing queue
- Still open: More dropdown keyboard navigation (arrow keys)
- Still open: Should `clearAllTabs` queue tab content before clearing?

**Open questions**:
- Still open: Add DOMPurify if the app ever becomes multi-user.

---

## 2026-03-31 — Format bar, selection toolbar, desktop height, meta bar, shortcuts

**What changed**: Major UI feature additions following user request, with three rounds of fresh-eyes auditing to find bugs introduced or missed along the way.

New features:
- **Formatting syntax bar** between editor and meta row: syntax selector left, context-aware format buttons middle (B/I/S/code/heading/blockquote/bullet + More dropdown), Write/Preview toggle right. Buttons change per syntax — Markdown family gets formatting buttons, Taskpaper gets @-tag buttons, Simple List gets bullet/checkbox, Plain Text gets nothing.
- **Floating selection toolbar**: pill-shaped overlay appears above selected text in markdown syntaxes. Buttons: Bold, Italic, Strikethrough, Code, Link.
- **Desktop editor height**: on load and resize (>=900px), editor min-height is calculated so the footer sits at the bottom of the viewport. Uses CSS custom property `--editor-min-h` overriding CM6's inline theme.
- **Meta bar reorder**: Flag and Location moved to far left, Tags to their right, Attach button moved to right side alongside Clear/Create with secondary-button styling.
- **Keyboard shortcuts**: changed from Shift+Ctrl to Shift+Meta (⇧⌘) across all 5 shortcuts.
- **Top text margin**: set equal to left margin (22px) in textarea, CM6 content, and preview pane.

Bugs found and fixed across three audit passes:
- Double border between content-field and format-bar (content-field had border-bottom, format-bar had border-top — removed the latter).
- Selection toolbar animation broken: `display: none → flex` prevents opacity/transform transitions. Fixed using `visibility: hidden/visible` with delayed transition on hide.
- Selection toolbar not dismissing when clicking outside editor — added document `mousedown` listener.
- `renderFormatButtons` not called on tab switch — `sel.value = x` doesn't fire `change` event; fixed by calling `renderFormatButtons(tab.syntax)` directly in `loadTabContent`.

**Decisions made**:
- Format bar uses white background (`--surface`) vs. meta row's light gray (`--surface-2`) to feel distinct without being jarring.
- Selection toolbar uses `visibility` + `pointer-events` for show/hide instead of `display` so opacity/transform transitions animate correctly. The `visibility` delay trick: `transition: visibility 0s 0.12s` on hide so visibility changes only after the fade-out completes.
- Desktop height uses `belowH = footerRect.bottom - cmRect.bottom` which is constant regardless of editor height (everything below the editor moves with it), enabling a single-pass calculation without resetting to 0.
- CM6's inline theme uses `minHeight` inline style — needed `!important` on the CSS custom property rule to override it.
- All DOM creation in format bar uses safe DOM methods (createElement/textContent/appendChild) — the security hook blocked innerHTML usage.
- `fitEditorToViewport` called with `setTimeout(..., 250)` to give CM6 time to mount from esm.sh; DOMContentLoaded waits for module execution per spec, so 250ms should always be sufficient.

**Left off at**: All requested features implemented and audited through three fresh-eyes passes. App is in good shape. Possible next directions:
- Still open from previous: allow editing the Mail Drop address without losing queue
- Still open from previous: PWA manifest / installable app experience
- Still open from previous: Dark mode
- New: the More dropdown could benefit from keyboard navigation (arrow keys)

**Open questions**:
- Still open: Should `clearAllTabs` queue tab content before clearing (for consistency with individual tab close)?
- Still open: Add DOMPurify if the app ever becomes multi-user.

---

## 2026-03-31 — Code quality passes, favicon fix, unofficial attribution

**What changed**: Three rounds of code review and cleanup (automated agents + manual UltraThink passes), favicon regenerated with rounded corners baked in, unofficial attribution added throughout, README updated with full feature list.

Specific fixes across the session:
- Favicon: regenerated all icon files (32px, 180px, 512px) from source JPEG using Pillow with ~22% corner radius mask to match iOS App Store icon appearance. `drafts-icon.png` was a JPEG with a `.png` extension — now a real PNG.
- Attribution: footer now reads "Unofficial capture tool. Drafts is made by Agile Tortoise." with links to getdrafts.com and agiletortoise.com. README updated to match.
- `mousemove`/`mouseup` drag listeners: were permanently attached to `document` for the lifetime of the page. Now added on mousedown and removed on mouseup.
- `renderTabs()` on keystroke: was tearing down and rebuilding all tab DOM + re-attaching all listeners every 400ms. Now does an in-place label update for the active tab only.
- `clearAllTabs` two-step confirmation: previously used both `dataset.confirmPending` AND `clearAllConfirmTimer` as dual truth sources. Collapsed to timer only.
- `sendDraftData`: removed dead `|| localStorage.getItem(...)` fallback (all callers already resolve email before calling).
- `isDown` variable in drag scroll: was set but never read after removing the guard — deleted.
- Double `renderTabs()` after form submit success — `clearForm()` already calls it.
- Tooltip on new-tab button was `⌘N` — corrected to `⇧⌃N`.
- Dead CSS class `.get-drafts-link` and empty `.syntax-field {}` ruleset — removed.
- Redundant `border-radius:5px;flex-shrink:0;` inline style on logo img — both already handled in CSS or visually inert.
- Queue buttons used bare `onclick="submitAllDrafts()"` without optional chaining — updated to `window.X?.()` pattern.
- `syncTagsHidden()` called twice on chip removal (once in handler, once at end of `renderChips`) — removed first call.

**Decisions made**:
- Used Python Pillow (available on the system) to bake rounded corners into PNG icons rather than relying on browser CSS `border-radius` clipping. The App Store icon style uses ~22% superellipse radius.
- `apple-touch-icon` also got rounded corners baked in, even though iOS applies its own mask. Minor cosmetic choice.
- Kept `checkAuth()` explicit `captureSection.style.display` mutation even though `body.setup-mode` CSS handles hiding — the explicit clear is load-bearing for FOUC prevention (inline `style="display:none"` in HTML must be cleared by JS).
- `clearAllTabs` is intentionally destructive without queuing content — distinct from individual tab close which auto-sends. The two-step confirm is the only guard, by design.
- Kept `marked` without sanitization — acceptable for a self-serve capture tool where the user is injecting into their own browser.

**Left off at**: App is in good shape and fully deployed. No known bugs. The next session should probably focus on user-facing polish or new features if any are desired. Possible directions:
- Allow editing the Mail Drop address without losing queue
- PWA manifest / installable app experience
- Dark mode

**Open questions**:
- Should `clearAllTabs` queue tab content before clearing, for consistency with individual tab close? Currently it silently discards.
- The `marked` library renders unsanitized HTML — acceptable now, but worth adding DOMPurify if this ever becomes multi-user.

---
