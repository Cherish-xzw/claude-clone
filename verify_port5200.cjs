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

  console.log('Navigating to app on port 5200...');
  await page.goto('http://localhost:5200', {waitUntil: 'domcontentloaded', timeout: 30000});

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

  const title = await page.title();
  console.log('\nPage title:', title);

  const inputExists = await page.evaluate(() => !!document.querySelector('#message-input'));
  const hasNewChat = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent.includes('New Chat'));
  });

  console.log('Message input exists:', inputExists);
  console.log('Has New Chat button:', hasNewChat);

  await browser.close();

  if (inputExists && hasNewChat) {
    console.log('\n=== APP VERIFICATION: PASSING ===');
    process.exit(0);
  } else {
    console.log('\n=== APP VERIFICATION: NEEDS ATTENTION ===');
    process.exit(1);
  }
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
