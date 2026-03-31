const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');

code = code.replace(/content:\s*draftData\.content,\s*tags:\s*draftData\.tags/g, "...draftData");
code = code.replace(/content:\s*draftQueue\[index\]\.content,\s*tags:\s*draftQueue\[index\]\.tags/g, "...draftQueue[index]");
code = code.replace(/content:\s*allDrafts\[i\]\.content,\s*tags:\s*allDrafts\[i\]\.tags/g, "...allDrafts[i]");

fs.writeFileSync('public/js/app.js', code);
