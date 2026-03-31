const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

const replacement = `function handleUrlParameters() {
        const p = new URLSearchParams(window.location.search);

        const text = p.get('text');
        if (text) {
            setEditorContent(decodeURIComponent(text));
        } else {
            const url   = p.get('url');
            const title = p.get('title');
            const sel   = p.get('sel');
            if (url && title) {
                let s = \`[\${title}](\${url})\`;
                if (sel) s += \`\\n\\n> \${sel}\\n\`;
                setEditorContent(s);
            }
        }

        const tags = p.get('tags');
        if (tags) setTagsFromString(decodeURIComponent(tags));

        const redirect = p.get('redirect');
        const urlParam = p.get('url');
        if (redirect && urlParam) {
            localStorage.setItem('captureRedirectType', redirect);
            localStorage.setItem('captureRedirectUrl',  urlParam);
        }
    }

    // ── Draft queue`;

code = code.replace(/function handleUrlParameters\(\) \{[\s\S]*?\/\/ ── Draft queue/, replacement);
fs.writeFileSync('public/js/app.js', code);
