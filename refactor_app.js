const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const PROXY_URL = 'https://drafts-ck-proxy.oliverames.workers.dev';

// Replace CloudKit authentication logic with Mail Drop address logic
code = code.replace(
    /if \(window\.cloudkit && window\.cloudkit\.isAuthenticated\(\)\) \{/g,
    `const email = localStorage.getItem('mailDropAddress');\n        if (email) {`
);

code = code.replace(
    /if \(!window\.cloudkit\?\.isAuthenticated\(\)\) \{/g,
    `if (!localStorage.getItem('mailDropAddress')) {`
);

// Replace createDraft calls
const createDraftRegex = /window\.cloudkit\.createDraft\(([^)]+)\)\s*\.then\(([^)]+)\)\s*\.catch\(([^)]+)\);/g;
const replacement = `fetch('${PROXY_URL}', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, content: $1.content, tags: $1.tags })
            })
            .then(r => r.json().then(d => r.ok ? d : Promise.reject(d.error || 'API Error')))
            .then($2)
            .catch($3);`;
code = code.replace(createDraftRegex, replacement);

// Replace specific CloudKit error messages
code = code.replace(/"CloudKit error:"/g, '"Mail Drop error:"');

// Handle the URL link in handleFormSubmit
// Mail Drop doesn't return a draft UUID, so we can't deep-link to the created draft.
code = code.replace(/<a href="\$\{result\.draft\.draftsUrl\}" target="_blank" rel="noopener">Open in Drafts &rarr;<\/a>/g, 'Draft sent via Mail Drop!');

// Setup UI logic
code = code.replace(/document\.getElementById\('sign-in-section'\)/g, `document.getElementById('setup-section')`);
code = code.replace(/document\.getElementById\('use-local-btn'\)\?\.addEventListener\('click', \(\) => {/g, `
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
        if (input.value.includes('@drafts.io')) {
            localStorage.setItem('mailDropAddress', input.value.trim());
            checkAuth();
            if (window.submitAllDrafts && draftQueue.length > 0) {
                if (confirm('Submit queued drafts now?')) window.submitAllDrafts();
            }
        } else {
            showAlert('Please enter a valid @drafts.io email address', 'error');
        }
    });

    document.getElementById('change-address-btn')?.addEventListener('click', () => {
        localStorage.removeItem('mailDropAddress');
        localStorage.removeItem('skipCloudKit');
        checkAuth();
    });

    document.getElementById('use-local-btn')?.addEventListener('click', () => {`);

// Sign out logic
code = code.replace(/document\.getElementById\('sign-out-btn'\)\?\.addEventListener\('click', \(\) => \{[\s\S]*?\}\);/g, '');

// Clean up draftData payload creation
code = code.replace(/const draftData = \{ content: content\.trim\(\), tags, syntax, flagged, latitude, longitude \};/g, `const draftData = { content: content.trim(), tags };`);
code = code.replace(/content:\s*t\.content\.trim\(\),\s*tags:\s*t\.tags,\s*syntax:\s*t\.syntax,\s*flagged:\s*t\.flagged,\s*latitude:\s*0,\s*longitude:\s*0/g, `content: t.content.trim(), tags: t.tags`);
code = code.replace(/content:\s*tab\.content\.trim\(\),\s*tags:\s*tab\.tags,\s*syntax:\s*tab\.syntax,\s*flagged:\s*tab\.flagged,\s*latitude:\s*0,\s*longitude:\s*0/g, `content: tab.content.trim(), tags: tab.tags`);

// Clean up tabs defaults
code = code.replace(/syntax:\s*data\.syntax\s*\|\|.*?,/g, '');
code = code.replace(/flagged:\s*!!data\.flagged,/g, '');

// Remove syntax and flagged DOM accesses
code = code.replace(/tab\.syntax\s*=\s*document\.getElementById\('draft-syntax'\)\.value;/g, '');
code = code.replace(/tab\.flagged\s*=\s*document\.getElementById\('draft-flagged'\)\.checked;/g, '');
code = code.replace(/const sel = document\.getElementById\('draft-syntax'\);[\s\S]*?tab\.flagged;/g, '');
code = code.replace(/document\.getElementById\('draft-flagged'\)\.checked = false;/g, '');
code = code.replace(/const syntax\s*=\s*document\.getElementById\('draft-syntax'\)\.value;/g, '');
code = code.replace(/const flagged\s*=\s*document\.getElementById\('draft-flagged'\)\.checked;/g, '');
code = code.replace(/const useLocation\s*=\s*document\.getElementById\('draft-location'\)\.checked;/g, '');

// Remove Geolocation prompt
code = code.replace(/let latitude = 0\.0, longitude = 0\.0;[\s\S]*?\}\s*catch\s*\{ \/\* proceed without location \*\/ \}\n\s*\}/, '');

// Clean up draft queue editing
code = code.replace(/document\.getElementById\('draft-syntax'\)\.value\s*=\s*draft\.syntax\s*\|\|\s*'Markdown';/g, '');
code = code.replace(/document\.getElementById\('draft-flagged'\)\.checked\s*=\s*!!draft\.flagged;/g, '');

// Clean preferences saving
code = code.replace(/function savePreferences\(\) \{[\s\S]*?\}/, 'function savePreferences() {}');
code = code.replace(/function loadPreferences\(\) \{[\s\S]*?\}/, 'function loadPreferences() {}');

// Remove syntax & location param parsing
code = code.replace(/if \(p\.get\('flagged'\) === '1'\) \{[\s\S]*?\}/, '');
code = code.replace(/const syntax = p\.get\('syntax'\);[\s\S]*?\}\s*\}/, '');

fs.writeFileSync('public/js/app.js', code);
console.log('App.js refactored');
