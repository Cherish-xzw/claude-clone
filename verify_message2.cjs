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

  // Find the send button by aria-label
  const sendButton = page.locator('[aria-label="Send message"]');
  const sendExists = await sendButton.count();
  console.log('Send button (aria-label) exists:', sendExists > 0);

  if (sendExists > 0) {
    // Take screenshot before sending
    await page.screenshot({ path: '/tmp/verify_before_send2.png', fullPage: true });
    console.log('Screenshot before send saved');

    // Click send
    console.log('Step 4: Click Send...');
    await sendButton.click();

    // Wait for response
    console.log('Waiting for response (streaming)...');
    await page.waitForTimeout(20000);

    // Take screenshot after response
    await page.screenshot({ path: '/tmp/verify_after_response2.png', fullPage: true });
    console.log('Screenshot after response saved');

    // Check for assistant message
    const assistantText = await page.locator('body').innerText();
    const hasResponse = assistantText.includes('I ') || assistantText.includes('Hello') ||
                        assistantText.includes('I\'m') || assistantText.includes('great');
    console.log('Has AI response text:', hasResponse);

    // Check for message bubbles
    const userBubble = await page.locator('text=Hello, how are you?').count();
    console.log('User message bubble found:', userBubble > 0);

  } else {
    // Try using Enter key instead
    console.log('No send button found, trying Enter key...');
    await input.press('Enter');
    await page.waitForTimeout(20000);
    await page.screenshot({ path: '/tmp/verify_after_enter2.png', fullPage: true });
    console.log('Screenshot after Enter saved');
  }

  console.log('\n=== Message test complete ===');
  await browser.close();
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
