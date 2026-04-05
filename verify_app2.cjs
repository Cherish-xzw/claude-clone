const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  let errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    errors.push(err.message);
  });

  console.log('Setting login state before page load...');
  // Add cookie/storage before page load
  await context.addInitScript(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });

  console.log('Navigating to app...');
  await page.goto('http://localhost:5174', {waitUntil: 'networkidle2', timeout: 30000});
  await new Promise(r => setTimeout(r, 5000));

  const title = await page.title();
  console.log('Page title:', title);

  const inputExists = await page.evaluate(() => !!document.querySelector('#message-input'));
  const hasNewChat = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent.includes('New Chat'));
  });

  console.log('Message input exists:', inputExists);
  console.log('Has New Chat button:', hasNewChat);
  console.log('Console errors:', errors.length);

  // Get page HTML for debugging
  const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Body text:', bodyText);

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
