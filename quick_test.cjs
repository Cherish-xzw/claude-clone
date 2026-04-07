const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  console.log('1. Navigating to app on port 5400...');
  await page.goto('http://localhost:5400', {waitUntil: 'domcontentloaded', timeout: 30000});

  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Testing New Chat button...');
  const allButtons = await page.$$('button');
  for (const btn of allButtons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('New Chat')) {
      await btn.click();
      console.log('   New Chat clicked');
      await new Promise(r => setTimeout(r, 1000));
      break;
    }
  }

  console.log('3. Testing message input...');
  const input = await page.$('#message-input');
  if (input) {
    await input.type('Hello, this is a test message');
    console.log('   Message typed');
  } else {
    console.log('   Input not found');
  }

  console.log('4. Testing send button...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const title = await btn.evaluate(el => el.title);
    if (title === 'Send') {
      await btn.click();
      console.log('   Send button clicked');
      await new Promise(r => setTimeout(r, 3000));
      break;
    }
  }

  // Check if message was sent
  const pageContent = await page.evaluate(() => document.body.innerText);
  const messageSent = pageContent.includes('Hello, this is a test message');

  console.log('\n=== RESULTS ===');
  console.log('Message sent:', messageSent);
  console.log('\n=== TEST:', (messageSent) ? 'PASSING' : 'NEEDS ATTENTION', '===');

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
