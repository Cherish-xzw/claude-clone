const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  console.log('1. Navigating to port 5174...');
  await page.goto('http://localhost:5174', {waitUntil: 'networkidle2', timeout: 30000});

  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 3000));

  console.log('\n--- Initial state ---');
  const initialText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('Initial text:', initialText.substring(0, 300));

  // Check for input before clicking New Chat
  const inputBefore = await page.$('#message-input');
  console.log('Input before click:', !!inputBefore);

  // Find and click New Chat button
  console.log('\n2. Clicking New Chat...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('New Chat') && !text.includes('day')) {
      await btn.click();
      console.log('   Clicked button:', text.substring(0, 30));
      await new Promise(r => setTimeout(r, 3000));
      break;
    }
  }

  console.log('\n--- After New Chat ---');
  const afterText = await page.evaluate(() => document.body.innerText.substring(0, 500));
  console.log('After text:', afterText.substring(0, 300));

  // Check for input after clicking
  const inputAfter = await page.$('#message-input');
  console.log('Input after click:', !!inputAfter);

  // Try to find input by different selectors
  const textareas = await page.$$('textarea');
  console.log('Textarea count:', textareas.length);

  const inputs = await page.$$('input');
  console.log('Input count:', inputs.length);

  if (inputs.length > 0) {
    console.log('Input types:', await Promise.all(inputs.map(i => i.evaluate(el => el.type))));
  }

  // Try typing in the first input
  if (inputs.length > 0) {
    console.log('\n3. Trying to type in first input...');
    await inputs[0].type('Hello world');
    await new Promise(r => setTimeout(r, 500));

    const inputValue = await inputs[0].evaluate(el => el.value);
    console.log('Input value:', inputValue);
  }

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
