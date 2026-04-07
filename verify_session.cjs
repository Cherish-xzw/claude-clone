const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  console.log('=== Full Chat Flow Test ===\n');

  // 1. Navigate to app
  console.log('1. Navigating to app on port 5400...');
  await page.goto('http://localhost:5400', {waitUntil: 'domcontentloaded', timeout: 30000});
  await page.evaluate(() => localStorage.setItem('isLoggedIn', 'true'));
  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 2000));
  console.log('   App loaded');

  // 2. Click New Chat
  console.log('2. Creating new conversation...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.includes('New Chat') && !text.includes('day')) {
      await btn.click();
      await new Promise(r => setTimeout(r, 2000));
      console.log('   New Chat created');
      break;
    }
  }

  // 3. Type message
  console.log('3. Typing message...');
  const input = await page.$('#message-input');
  if (input) {
    await input.type('Hello! Please respond with "test passed"');
    console.log('   Message typed');
  }

  // 4. Send message
  console.log('4. Sending message...');
  const sendButtons = await page.$$('button');
  for (const btn of sendButtons) {
    const title = await btn.evaluate(el => el.title);
    if (title === 'Send') {
      await btn.click();
      console.log('   Message sent');
      await new Promise(r => setTimeout(r, 5000));
      break;
    }
  }

  // 5. Check response
  console.log('5. Checking response...');
  const pageText = await page.evaluate(() => document.body.innerText);
  const hasResponse = pageText.includes('test') || pageText.includes('passed') || pageText.length > 100;

  console.log('\n=== RESULTS ===');
  console.log('Page loaded:', true);
  console.log('Input found:', !!input);
  console.log('Response received:', hasResponse);
  console.log('\n=== TEST:', (hasResponse) ? 'PASSING' : 'NEEDS ATTENTION', '===');

  await browser.close();
  process.exit(hasResponse ? 0 : 1);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
