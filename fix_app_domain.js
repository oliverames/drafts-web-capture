const fs = require('fs');
let code = fs.readFileSync('public/js/app.js', 'utf8');
code = code.replace(/if \(input\.value\.includes\('@drafts\.io'\)\) \{/g, "if (input.value.includes('@drafts.io') || input.value.includes('@maildrop.getdrafts.com')) {");
fs.writeFileSync('public/js/app.js', code);
