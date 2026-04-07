const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  // Listen for network responses
  page.on('response', response => {
    if (response.status() >= 400) {
      console.log('NETWORK ERROR:', response.status(), response.url());
    }
  });

  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5174', {waitUntil: 'domcontentloaded', timeout: 30000});

  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- Checking initial state ---');
  const initialText = await page.evaluate(() => document.body.innerText);
  console.log('Initial text (first 500 chars):', initialText.substring(0, 500));

  // Find and click New Chat button
  console.log('\n2. Looking for New Chat button...');
  const buttons = await page.$$('button');
  let newChatBtn = null;
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('New Chat')) {
      newChatBtn = btn;
      console.log('   Found button:', text.substring(0, 50));
      break;
    }
  }

  if (newChatBtn) {
    await newChatBtn.click();
    console.log('   Clicked New Chat');
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n--- After clicking New Chat ---');
  const afterText = await page.evaluate(() => document.body.innerText);
  console.log('After text (first 800 chars):', afterText.substring(0, 800));

  // Check for input
  const inputExists = await page.$('#message-input');
  console.log('\nInput exists:', !!inputExists);

  // Get all text areas
  const textareas = await page.$$('textarea');
  console.log('Textarea count:', textareas.length);

  // Get root HTML
  const rootHTML = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 5000));
  console.log('\nRoot HTML snippet:', rootHTML?.substring(0, 2000));

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
