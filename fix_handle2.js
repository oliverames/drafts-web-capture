const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(
/savePreferences\(\);\n\n        \n\n        const draftData = \{ content: content\.trim\(\), tags, syntax, flagged, latitude, longitude \};/,
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
