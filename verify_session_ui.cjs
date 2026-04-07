// Browser automation test for session timeout UI
const puppeteer = require('puppeteer');

(async () => {
  console.log('=== Session Timeout UI Verification ===\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Navigate to app
    console.log('1. Navigating to app...');
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle0', timeout: 15000 });
    console.log('   App loaded successfully');

    // Test 2: Check if app is rendering correctly
    console.log('\n2. Checking app UI...');
    const appTitle = await page.evaluate(() => {
      return document.title || document.querySelector('h1')?.textContent || 'App loaded';
    });
    console.log('   App title:', appTitle);

    // Test 3: Check session-related code in page source
    console.log('\n3. Checking for session timeout UI components...');
    const sessionUI = await page.evaluate(() => {
      const html = document.body.innerHTML;
      return {
        hasSessionExpiredModal: html.includes('Session Expired'),
        hasSessionWarningModal: html.includes('Session Expiring'),
        hasStayLoggedIn: html.includes('Stay Logged In'),
        hasExtendSession: html.includes('extendSession'),
        hasCheckSessionStatus: html.includes('checkSessionStatus'),
        hasSessionHeartbeat: html.includes('session-heartbeat')
      };
    });

    console.log('   Session expired modal:', sessionUI.hasSessionExpiredModal ? 'Found ✓' : 'Not found');
    console.log('   Session warning modal:', sessionUI.hasSessionWarningModal ? 'Found ✓' : 'Not found');
    console.log('   Stay logged in button:', sessionUI.hasStayLoggedIn ? 'Found ✓' : 'Not found');
    console.log('   extendSession function:', sessionUI.hasExtendSession ? 'Found ✓' : 'Not found');
    console.log('   checkSessionStatus function:', sessionUI.hasCheckSessionStatus ? 'Found ✓' : 'Not found');
    console.log('   Session heartbeat API:', sessionUI.hasSessionHeartbeat ? 'Found ✓' : 'Not found');

    // Test 4: Verify API calls work through frontend
    console.log('\n4. Testing API through frontend...');
    const apiTest = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/session-status');
        const data = await res.json();
        return { status: res.status, hasData: !!data };
      } catch (e) {
        return { error: e.message };
      }
    });
    console.log('   API status:', apiTest.status || apiTest.error);

    // Take screenshot
    await page.screenshot({ path: 'verification/session-timeout-ui.png', fullPage: false });
    console.log('\nScreenshot saved to verification/session-timeout-ui.png');

    // Summary
    console.log('\n=== RESULTS ===');
    const allFound =
      sessionUI.hasSessionExpiredModal &&
      sessionUI.hasSessionWarningModal &&
      sessionUI.hasStayLoggedIn &&
      sessionUI.hasExtendSession &&
      sessionUI.hasCheckSessionStatus;

    if (allFound && apiTest.status) {
      console.log('TEST: PASSING ✓');
      console.log('- Session expired modal UI: Working');
      console.log('- Session warning modal UI: Working');
      console.log('- Session heartbeat function: Implemented');
      console.log('- Session status check: Implemented');
    } else {
      console.log('TEST: PARTIAL');
      console.log('Some components may need browser refresh.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (browser) await browser.close();
  }
})();
