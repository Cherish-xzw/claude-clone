const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  let errors = [];
  let failedRequests = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });
  page.on('requestfailed', req => {
    failedRequests.push({url: req.url(), failure: req.failure()});
  });
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log('HTTP Error:', resp.status(), resp.url());
    }
  });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5174', {waitUntil: 'domcontentloaded', timeout: 30000});

  // Set localStorage immediately after DOM loads
  await page.evaluate(() => {
    window.localStorage.setItem('isLoggedIn', 'true');
  });

  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n=== Results ===');
  console.log('Failed requests:', failedRequests.length);
  failedRequests.forEach(r => console.log(' -', r.url, r.failure.errorText));

  console.log('\nConsole errors:', errors.length);
  errors.forEach(e => console.log(' -', e));

  const rootContent = await page.evaluate(() => {
    const root = document.getElementById('root');
    return root ? root.innerHTML.substring(0, 1000) : 'NO ROOT ELEMENT';
  });
  console.log('\nRoot content:', rootContent);

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
