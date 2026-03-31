const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:8091');
  await page.fill('#maildrop-input', 'drafts+XsSnW2uNdPMs259cs4w5aDd5@maildrop.getdrafts.com');
  await page.click('#save-maildrop-btn');

  // Verify UI elements are present
  const hasSyntax = await page.isVisible('#draft-syntax');
  console.log('UI Restored -> Syntax dropdown:', hasSyntax);

  await page.evaluate(() => {
    window.__editor.setValue('Testing UI Restored\n\nThis draft has tags, syntax, and flags.');
    document.getElementById('draft-syntax').value = 'Taskpaper';
    document.getElementById('draft-flagged').checked = true;
  });
  
  await page.fill('#tags-input', 'important, test');
  await page.keyboard.press('Enter');

  const [request] = await Promise.all([
    page.waitForRequest(req => req.url().includes('drafts-ck-proxy.oliverames.workers.dev') && req.method() === 'POST'),
    page.click('#capture-form button[type="submit"]')
  ]);

  console.log('API Request URL:', request.url());
  console.log('API Request Payload:', JSON.parse(request.postData()));

  await browser.close();
})();
