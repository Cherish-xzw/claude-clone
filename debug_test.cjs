const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  // Enable console logging
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  console.log('1. Navigating to app on port 5174...');
  await page.goto('http://localhost:5174', {waitUntil: 'domcontentloaded', timeout: 30000});

  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- BEFORE CLICKING NEW CHAT ---');
  let html = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 2000) || 'No root');
  console.log('Root HTML:', html.substring(0, 500));

  console.log('\n2. Testing New Chat button...');
  const allButtons = await page.$$('button');
  for (const btn of allButtons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('New Chat')) {
      await btn.click();
      console.log('   New Chat clicked');
      await new Promise(r => setTimeout(r, 2000));
      break;
    }
  }

  console.log('\n--- AFTER CLICKING NEW CHAT ---');
  html = await page.evaluate(() => document.getElementById('root')?.innerHTML?.substring(0, 3000) || 'No root');
  console.log('Root HTML length:', html.length);

  // Check for input
  const inputExists = await page.$('#message-input');
  console.log('Input exists:', !!inputExists);

  // Get all text areas
  const textareas = await page.$$('textarea');
  console.log('Textarea count:', textareas.length);

  // Get all buttons
  const buttons = await page.$$('button');
  const buttonTexts = [];
  for (const btn of buttons) {
    buttonTexts.push(await btn.evaluate(el => el.textContent.trim().substring(0, 30)));
  }
  console.log('All buttons:', buttonTexts);

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
