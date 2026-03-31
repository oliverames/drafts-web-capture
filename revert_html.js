const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

// Replace sign-in-card with setup-card
const signinRegex = /<div id="sign-in-section"[^>]*>[\s\S]*?<\/div>\s*<!-- Capture form -->/;
const setupCard = `<div id="setup-section" class="card sign-in-card" style="display: none;">
                <h1 class="sign-in-title">Drafts Capture</h1>
                <p class="sign-in-description">Enter your Drafts Mail Drop address to capture drafts directly. Find this in the Drafts app under Settings &rarr; Mail Drop.</p>
                <div style="margin: 20px auto; max-width: 280px;">
                    <input type="email" id="maildrop-input" placeholder="drafts-xxxxx@drafts.io" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--divider); outline: none; margin-bottom: 12px; font-family: monospace;">
                    <button type="button" id="save-maildrop-btn" class="btn-create" style="width: 100%; justify-content: center;">Save & Continue</button>
                </div>
                <button type="button" id="use-local-btn" class="btn-use-local">Continue offline (queued)</button>
            </div>

            <!-- Capture form -->`;
html = html.replace(signinRegex, setupCard);

// Remove scripts
html = html.replace(/<script src="config\.js"><\/script>\n/, '');
html = html.replace(/<script async src="https:\/\/appleid\.cdn-apple\.com[^>]*><\/script>\n/, '');
html = html.replace(/<script async src="https:\/\/cdn\.apple-cloudkit\.com[^>]*><\/script>\n/, '');
html = html.replace(/<script src="js\/cloudkit\.js"><\/script>\n/, '');

// Add change mail drop button to footer
const footerNavRegex = /<nav class="footer-nav">([\s\S]*?)<\/nav>/;
html = html.replace(/<span class="footer-sep">·<\/span>\s*<button type="button" id="sign-out-btn" class="btn-sign-out">Sign out<\/button>/, '');
html = html.replace(footerNavRegex, `<nav class="footer-nav">
                <a href="https://docs.getdrafts.com/docs/extensions/maildrop" class="help-link" target="_blank" rel="noopener">Mail Drop Help</a>
                <span class="footer-sep">·</span>
                <button type="button" id="change-address-btn" class="btn-sign-out">Change Address</button>
            </nav>`);

fs.writeFileSync('public/index.html', html);
console.log('HTML updated');
