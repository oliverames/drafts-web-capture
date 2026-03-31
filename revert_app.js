const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const PROXY_URL = 'https://drafts-ck-proxy.oliverames.workers.dev';

// Auth checks
code = code.replace(
    /if \(window\.cloudkit && window\.cloudkit\.isAuthenticated\(\)\) \{/g,
    `const email = localStorage.getItem('mailDropAddress');\n        if (email) {`
);

code = code.replace(
    /if \(!window\.cloudkit\?\.isAuthenticated\(\)\) \{/g,
    `if (!localStorage.getItem('mailDropAddress')) {`
);

// createDraft replacements
const createDraftRegex = /window\.cloudkit\.createDraft\(([^)]+)\)\s*\.then\(([^)]+)\)\s*\.catch\(([^)]+)\);/g;
const replacement = `fetch('${PROXY_URL}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('mailDropAddress'), ...$1 })
            })
            .then(r => r.json().then(d => r.ok ? { success: true, draft: {} } : Promise.reject(d.error || 'API Error')))
            .then($2)
            .catch($3);`;
code = code.replace(createDraftRegex, replacement);

const createDraftStandalone = /window\.cloudkit\.createDraft\(([^)]+)\)/g;
const standaloneReplacement = `fetch('${PROXY_URL}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: localStorage.getItem('mailDropAddress'), ...$1 })
            }).then(r => r.json().then(d => r.ok ? { success: true, draft: {} } : Promise.reject(d.error || 'API Error')))`;
code = code.replace(createDraftStandalone, standaloneReplacement);

// Error messages
code = code.replace(/"CloudKit error:"/g, '"Mail Drop error:"');
code = code.replace(/<a href="\$\{result\.draft\.draftsUrl\}" target="_blank" rel="noopener">Open in Drafts &rarr;<\/a>/g, 'Draft sent via Mail Drop!');

// Remove sign out logic
code = code.replace(/document\.getElementById\('sign-out-btn'\)\?\.addEventListener\('click', \(\) => \{[\s\S]*?\}\);/g, '');

// UI Toggle Logic
const regexAuthToggle = /\/\/ "Continue without signing in"[\s\S]*?\/\/ ── Tabs/;
const authToggleReplacement = `// ── Auth & Initialization ─────────────────────────────────
    const checkAuth = () => {
        if (localStorage.getItem('mailDropAddress') || localStorage.getItem('skipCloudKit') === '1') {
            document.getElementById('setup-section').style.display = 'none';
            document.getElementById('capture-section').style.display = '';
        } else {
            document.getElementById('setup-section').style.display = '';
            document.getElementById('capture-section').style.display = 'none';
        }
    };
    checkAuth();

    document.getElementById('save-maildrop-btn')?.addEventListener('click', () => {
        const input = document.getElementById('maildrop-input');
        if (input.value.includes('@drafts.io') || input.value.includes('@maildrop.getdrafts.com')) {
            localStorage.setItem('mailDropAddress', input.value.trim());
            localStorage.removeItem('skipCloudKit');
            checkAuth();
            if (window.submitAllDrafts && draftQueue.length > 0) {
                if (confirm('Submit queued drafts now?')) window.submitAllDrafts();
            }
        } else {
            showAlert('Please enter a valid @drafts.io address', 'error');
        }
    });

    document.getElementById('change-address-btn')?.addEventListener('click', () => {
        localStorage.removeItem('mailDropAddress');
        localStorage.removeItem('skipCloudKit');
        checkAuth();
    });

    document.getElementById('use-local-btn')?.addEventListener('click', () => {
        localStorage.setItem('skipCloudKit', '1');
        checkAuth();
    });

    // ── Tabs`;
code = code.replace(regexAuthToggle, authToggleReplacement);

// Fix initial state logic that used sign-in-section
code = code.replace(/document\.getElementById\('sign-in-section'\)/g, `document.getElementById('setup-section')`);

// Update messages
code = code.replace(/Sign in to/g, "Add a Mail Drop address to");

fs.writeFileSync('public/js/app.js', code);
console.log('App.js reverted & mail drop reapplied');
