const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  // Listen for network responses
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/')) {
      console.log('API Response:', response.status(), url);
    }
  });

  console.log('1. Navigating to port 5173...');
  await page.goto('http://localhost:5173', {waitUntil: 'domcontentloaded', timeout: 30000});

  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- Initial state ---');
  const initialText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Text:', initialText);

  // Find and click New Chat button
  console.log('\n2. Clicking New Chat...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('New Chat') && !text.includes('1 day')) {
      await btn.click();
      console.log('   Clicked');
      await new Promise(r => setTimeout(r, 3000));
      break;
    }
  }

  console.log('\n--- After New Chat ---');
  const afterText = await page.evaluate(() => document.body.innerText.substring(0, 800));
  console.log('Text:', afterText);

  // Check for input
  const inputExists = await page.$('#message-input');
  console.log('\nInput exists:', !!inputExists);

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
