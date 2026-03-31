// Textarea auto-resize using @chenglou/pretext
// https://github.com/chenglou/pretext
// Measures text height via canvas font metrics — no DOM reflow.

import { prepare, layout } from 'https://esm.sh/@chenglou/pretext';

const ta = document.getElementById('draft-content');

if (ta) {
    try {
        prepare(ta);

        const resize = () => { try { layout(ta); } catch {} };

        ta.addEventListener('input', resize);
        window.addEventListener('resize', resize);

        // Initial layout — runs after HTML is parsed (modules are deferred).
        // URL-param content may not be set yet (app.js uses DOMContentLoaded),
        // so we also expose window.__resizeTextarea for app.js to call.
        resize();

        window.__resizeTextarea = resize;
    } catch {
        // Pretext may fail if CodeMirror hides the textarea — safe to ignore
    }
}
