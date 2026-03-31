const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

// The replacement logic for any window.cloudkit.createDraft(payload)
// We just replace `window.cloudkit.createDraft(payload)` with our fetch wrapper
const replacement = `fetch('https://drafts-ck-proxy.oliverames.workers.dev', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('mailDropAddress'), content: $1.content, tags: $1.tags })
            }).then(r => r.json().then(d => r.ok ? { success: true, draft: {} } : Promise.reject(d.error || 'API Error')))`;

code = code.replace(/window\.cloudkit\.createDraft\(([^)]+)\)/g, replacement);

// Fix remaining isAuthenticated checks
code = code.replace(/window\.cloudkit\?\.isAuthenticated\(\)/g, `localStorage.getItem('mailDropAddress')`);
code = code.replace(/window\.cloudkit && window\.cloudkit\.isAuthenticated\(\)/g, `localStorage.getItem('mailDropAddress')`);

// Remove any remaining syntax/flagged/location logic
code = code.replace(/tab\.syntax\s*=\s*document\.getElementById\('draft-syntax'\)\.value;/g, '');
code = code.replace(/tab\.flagged\s*=\s*document\.getElementById\('draft-flagged'\)\.checked;/g, '');
code = code.replace(/const sel = document\.getElementById\('draft-syntax'\);[\s\S]*?tab\.flagged;/g, '');
code = code.replace(/document\.getElementById\('draft-flagged'\)\.checked = false;/g, '');

fs.writeFileSync('public/js/app.js', code);
