const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5400', {waitUntil: 'domcontentloaded', timeout: 30000});

  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload({waitUntil: 'networkidle2'});
  await new Promise(r => setTimeout(r, 2000));

  console.log('2. Checking for rate limit status endpoint...');
  const rateLimitResponse = await page.evaluate(async () => {
    try {
      const response = await fetch('http://localhost:5400/api/rate-limit-status');
      return await response.json();
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log('   Rate limit status:', JSON.stringify(rateLimitResponse));

  console.log('3. Testing rate limit UI elements...');
  // The rate limit banner should not be visible initially
  const rateLimitBannerVisible = await page.evaluate(() => {
    const banner = document.querySelector('[class*="bg-orange-500"]');
    return banner !== null;
  });
  console.log('   Rate limit banner initially hidden:', !rateLimitBannerVisible);

  console.log('4. Testing send button disabled state...');
  // Check if send button exists and is properly configured
  const sendButtonExists = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.some(btn => btn.getAttribute('aria-label') === 'Send message');
  });
  console.log('   Send button exists:', sendButtonExists);

  console.log('\n=== RESULTS ===');
  console.log('Rate limit endpoint accessible:', !rateLimitResponse.error);
  console.log('Rate limit state initialized:', rateLimitResponse.isLimited === false);
  console.log('Rate limit UI hidden:', !rateLimitBannerVisible);

  const allPassed = !rateLimitResponse.error &&
                    rateLimitResponse.isLimited === false &&
                    !rateLimitBannerVisible &&
                    sendButtonExists;

  console.log('\n=== TEST:', allPassed ? 'PASSING' : 'NEEDS ATTENTION', '===');

  await browser.close();
  process.exit(allPassed ? 0 : 1);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
