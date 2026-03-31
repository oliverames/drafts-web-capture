const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(
/const content     = document\.getElementById\('draft-content'\)\.value;\n        const tags        = document\.getElementById\('draft-tags'\)\.value;\n        \n        \n        \n\n        if \(!content \|\| !content\.trim\(\)\) \{/,
`const content     = document.getElementById('draft-content').value;
        const tags        = document.getElementById('draft-tags').value;
        const sel         = document.getElementById('draft-syntax');
        const syntax      = sel ? sel.value : 'Markdown';
        const chk         = document.getElementById('draft-flagged');
        const flagged     = chk ? chk.checked : false;
        const locChk      = document.getElementById('draft-location');
        const useLocation = locChk ? locChk.checked : false;

        if (!content || !content.trim()) {`
);

// We also need to get latitude and longitude if they weren't restored!
code = code.replace(
/savePreferences\(\);\n\n        const draftData = \{ content: content\.trim\(\), tags, syntax, flagged, latitude, longitude \};/g,
`savePreferences();

        let latitude = 0.0, longitude = 0.0;
        if (useLocation && navigator.geolocation) {
            try {
                const pos = await new Promise((resolve, reject) =>
                    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
                );
                latitude  = pos.coords.latitude;
                longitude = pos.coords.longitude;
            } catch { /* proceed without location */ }
        }

        const draftData = { content: content.trim(), tags, syntax, flagged, latitude, longitude };`
);

fs.writeFileSync('public/js/app.js', code);
