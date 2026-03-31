const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(
/const draftData = { content: content\.trim\(\), tags };/,
`const draftData = { content: content.trim(), tags, syntax, flagged, latitude, longitude };`
);

fs.writeFileSync('public/js/app.js', code);
