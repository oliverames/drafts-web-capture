const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const regex = /\/\/ "Continue without signing in"[\s\S]*?\/\/ ── Tabs/;

const replacement = `// ── Auth & Initialization ─────────────────────────────────
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

code = code.replace(regex, replacement);

fs.writeFileSync('public/js/app.js', code);
