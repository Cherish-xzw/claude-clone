const { chromium } = require('playwright');

const CONFIG = {
  headless: true,
  channel: 'chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

async function test() {
  const browser = await chromium.launch(CONFIG);
  const page = await browser.newPage();

  console.log('Step 1: Navigate to app...');
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(2000);

  // Bypass login by setting localStorage
  console.log('Step 2: Bypass login...');
  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });

  // Reload to apply the login state
  await page.reload();
  await page.waitForTimeout(3000);

  // Check page title
  const title = await page.title();
  console.log('Page title after login:', title);

  // Check for New Chat button
  const newChatButton = await page.locator('button:has-text("New Chat")').count();
  console.log('New Chat button count:', newChatButton);

  // Check for message input
  const inputExists = await page.locator('#message-input').count();
  console.log('Message input exists:', inputExists > 0);

  // Check for sidebar
  const sidebarExists = await page.locator('.flex-shrink-0, [class*="sidebar"]').count();
  console.log('Sidebar elements found:', sidebarExists);

  // Get all buttons
  const buttons = await page.locator('button').allTextContents();
  console.log('All buttons:', JSON.stringify(buttons.slice(0, 15)));

  // Take screenshot
  await page.screenshot({ path: '/tmp/verify_logged_in.png', fullPage: true });
  console.log('Screenshot saved to /tmp/verify_logged_in.png');

  // Test core feature: Click New Chat
  if (newChatButton > 0) {
    console.log('Step 3: Clicking New Chat...');
    await page.locator('button:has-text("New Chat")').first().click();
    await page.waitForTimeout(1000);

    // Take screenshot after clicking New Chat
    await page.screenshot({ path: '/tmp/verify_new_chat.png', fullPage: true });
    console.log('Screenshot after New Chat saved');

    // Check if input is now visible
    const inputAfterClick = await page.locator('#message-input').count();
    console.log('Input visible after New Chat click:', inputAfterClick > 0);
  }

  await browser.close();
  console.log('\n=== Core verification complete ===');
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
