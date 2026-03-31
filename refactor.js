const fs = require('fs');

// 1. Delete unnecessary files
try { fs.unlinkSync('public/js/cloudkit.js'); } catch(e){}
try { fs.unlinkSync('public/config.js'); } catch(e){}

// 2. Update worker/index.js
const workerCode = `const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS });

    try {
      const { email, content, tags } = await request.json();
      
      if (!email || !content) {
        return new Response(JSON.stringify({ error: 'Missing email or content' }), { status: 400, headers: CORS });
      }

      // Format for Mail Drop
      // Subject = First line (max 150 chars) + #tags
      const lines = content.trim().split('\\n');
      let subject = lines[0].substring(0, 150);
      let body = lines.slice(1).join('\\n');
      
      if (tags) {
        // tags is a string like "tag1, tag2"
        const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (tagArray.length > 0) {
            const tagStr = tagArray.map(t => '#' + t.replace(/\\s+/g, '')).join(' ');
            subject = subject + ' ' + tagStr;
        }
      }

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': \`Bearer \${env.RESEND_API_KEY}\`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Capture <capture@drafts.amesvt.com>',
          to: email,
          subject: subject,
          text: body || ' ' // Resend requires text or html
        })
      });

      if (!res.ok) {
        const error = await res.text();
        return new Response(JSON.stringify({ error: \`Resend API Error: \${error}\` }), { status: 502, headers: CORS });
      }

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: CORS });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
    }
  }
};
`;
fs.writeFileSync('worker/index.js', workerCode);

// 3. Update worker/wrangler.toml
const wranglerCode = `name = "drafts-ck-proxy"
main = "index.js"
compatibility_date = "2023-10-30"

# Secret required:
# npx wrangler secret put RESEND_API_KEY
`;
fs.writeFileSync('worker/wrangler.toml', wranglerCode);

// 4. Update public/sw.js
const swCode = `/**
 * Service Worker — Standard cache (no longer proxying CloudKit)
 */
self.addEventListener('install',  e => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
    // Basic pass-through
    return;
});
`;
fs.writeFileSync('public/sw.js', swCode);

// 5. Update .github/workflows/deploy.yml
let deployYml = fs.readFileSync('.github/workflows/deploy.yml', 'utf8');
deployYml = deployYml.replace(/- name: Inject CloudKit API token[\s\S]*?run: \|[\s\S]*?config\.js\n\n/, '');
fs.writeFileSync('.github/workflows/deploy.yml', deployYml);

console.log('Phase 1 complete');
