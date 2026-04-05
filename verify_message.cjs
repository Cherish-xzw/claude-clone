const { chromium } = require('playwright');

const CONFIG = {
  headless: true,
  channel: 'chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

async function test() {
  const browser = await chromium.launch(CONFIG);
  const page = await browser.newPage();

  console.log('Step 1: Navigate and bypass login...');
  await page.goto('http://localhost:5174');
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload();
  await page.waitForTimeout(3000);

  // Click New Chat to ensure fresh conversation
  console.log('Step 2: Click New Chat...');
  await page.locator('button:has-text("New Chat")').first().click();
  await page.waitForTimeout(1000);

  // Type a simple message
  console.log('Step 3: Type message...');
  const input = page.locator('#message-input');
  await input.fill('Hello, how are you?');
  await page.waitForTimeout(500);

  // Take screenshot before sending
  await page.screenshot({ path: '/tmp/verify_before_send.png', fullPage: true });
  console.log('Screenshot before send saved');

  // Check send button
  const sendButton = page.locator('button:has-text("Send")');
  const sendExists = await sendButton.count();
  console.log('Send button exists:', sendExists > 0);

  // Click send (only if button exists)
  if (sendExists > 0) {
    console.log('Step 4: Click Send...');
    await sendButton.click();

    // Wait for response (with timeout)
    console.log('Waiting for response...');
    try {
      await page.waitForTimeout(15000); // Wait up to 15 seconds for response

      // Take screenshot after response
      await page.screenshot({ path: '/tmp/verify_after_response.png', fullPage: true });
      console.log('Screenshot after response saved');

      // Check if we got a response
      const assistantMessages = await page.locator('.bg-orange-50, [class*="assistant"]').count();
      console.log('Assistant message elements:', assistantMessages);

      // Get visible text to check for response
      const bodyText = await page.locator('body').innerText();
      const hasResponse = bodyText.includes('Claude') || bodyText.includes('I ') || bodyText.includes('Hello');
      console.log('Has response text:', hasResponse);

    } catch (e) {
      console.log('Error waiting for response:', e.message);
    }
  } else {
    console.log('No send button found - checking for alternative send method');
    // Try pressing Enter
    await input.press('Enter');
    await page.waitForTimeout(10000);
    await page.screenshot({ path: '/tmp/verify_after_enter.png', fullPage: true });
  }

  console.log('\n=== Message test complete ===');
  await browser.close();
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
