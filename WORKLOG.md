# Worklog

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
