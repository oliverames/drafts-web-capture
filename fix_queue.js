const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(
/addToQueue\(\{\s*content: t\.content\.trim\(\), tags: t\.tags\s*\}\);/g,
`addToQueue({ content: t.content.trim(), tags: t.tags, syntax: t.syntax, flagged: t.flagged, latitude: 0, longitude: 0 });`
);

code = code.replace(
/const draftData = \{\s*content: tab\.content\.trim\(\), tags: tab\.tags\s*\};/g,
`const draftData = { content: tab.content.trim(), tags: tab.tags, syntax: tab.syntax, flagged: tab.flagged, latitude: 0, longitude: 0 };`
);

fs.writeFileSync('public/js/app.js', code);
