const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// Replace the entire Preferences block
code = code.replace(/\/\/ ── Preferences ───────────────────────────────────────────[\s\S]*?\/\/ ── URL parameters \(bookmarklet\) ──────────────────────────/, `// ── Preferences ───────────────────────────────────────────

    function savePreferences() {}
    function loadPreferences() {}

    // ── URL parameters (bookmarklet) ──────────────────────────`);

fs.writeFileSync('public/js/app.js', code);
