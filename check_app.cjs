const { chromium } = require('playwright');

const CONFIG = {
  headless: true,
  channel: 'chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

async function test() {
  const browser = await chromium.launch(CONFIG);
  const page = await browser.newPage();

  console.log('Navigating to app...');
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(3000);

  // Get page title
  const title = await page.title();
  console.log('Page title:', title);

  // Check if there are any JavaScript errors
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.reload();
  await page.waitForTimeout(3000);

  // Get all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('Buttons found:', JSON.stringify(buttons.slice(0, 10)));

  // Check for input field
  const inputExists = await page.locator('#message-input').count();
  console.log('Message input exists:', inputExists > 0);

  // Check for New Chat button
  const hasNewChat = buttons.some(b => b.includes('New Chat'));
  console.log('Has New Chat button:', hasNewChat);

  // Take screenshot
  await page.screenshot({ path: '/tmp/verify_app.png', fullPage: true });
  console.log('Screenshot saved to /tmp/verify_app.png');

  // Print any errors
  if (errors.length > 0) {
    console.log('JavaScript errors:', errors);
  } else {
    console.log('No JavaScript errors detected');
  }

  await browser.close();
}

test().catch(console.error);
