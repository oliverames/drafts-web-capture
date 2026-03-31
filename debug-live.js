const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  console.log('Navigating to https://drafts.amesvt.com...');
  await page.goto('https://drafts.amesvt.com');
  console.log('Final URL:', page.url());
  console.log('Page title:', await page.title());
  
  const content = await page.content();
  console.log('Page content length:', content.length);
  // console.log('Snippet:', content.substring(0, 1000));

  await browser.close();
})();
