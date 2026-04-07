const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();

  let hasErrors = false;
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    hasErrors = true;
  });

  await page.goto('http://localhost:5400', {waitUntil: 'networkidle0'});

  // Set isLoggedIn to bypass login
  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });

  // Reload to apply the login state
  await page.reload({waitUntil: 'networkidle0'});
  await new Promise(r => setTimeout(r, 3000));
  console.log('Logged in and ready');

  // Check if message input exists
  const inputExists = await page.evaluate(() => !!document.querySelector('#message-input'));
  console.log('Message input exists:', inputExists);

  // Check if New Chat button exists
  const hasNewChat = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(b => b.textContent.includes('New Chat'));
  });
  console.log('Has New Chat button:', hasNewChat);

  // Check for any JavaScript errors
  console.log('Has JavaScript errors:', hasErrors);

  await browser.close();
  console.log('Done');

  if (inputExists && hasNewChat && !hasErrors) {
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
