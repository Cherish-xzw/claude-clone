const { chromium } = require('playwright');

const CONFIG = {
  headless: true,
  channel: 'chrome',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
};

async function test() {
  const browser = await chromium.launch(CONFIG);
  const page = await browser.newPage();

  console.log('Step 1: Navigate to app on port 5400 (dist build)...');
  await page.goto('http://localhost:5400');
  await page.waitForTimeout(2000);

  // Bypass login
  console.log('Step 2: Bypass login...');
  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });
  await page.reload();
  await page.waitForTimeout(3000);

  console.log('Step 3: Check PWA manifest...');
  const manifestExists = await page.evaluate(async () => {
    try {
      const response = await fetch('/manifest.json');
      if (response.ok) {
        const manifest = await response.json();
        return {
          exists: true,
          name: manifest.name,
          short_name: manifest.short_name,
          icons_count: manifest.icons?.length || 0
        };
      }
      return { exists: false };
    } catch (e) {
      return { exists: false, error: e.message };
    }
  });
  console.log('Manifest:', JSON.stringify(manifestExists));

  console.log('Step 4: Check Service Worker registration...');
  const swRegistered = await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        return registration ? 'registered' : 'not registered';
      } catch (e) {
        return 'error: ' + e.message;
      }
    }
    return 'not supported';
  });
  console.log('Service Worker status:', swRegistered);

  console.log('Step 5: Check PWA install elements...');
  const hasInstallElements = await page.evaluate(() => {
    return document.body.innerHTML.includes('Install Claude') ||
           document.body.innerHTML.includes('Install');
  });
  console.log('Has install elements:', hasInstallElements);

  console.log('Step 6: Check meta tags for PWA...');
  const metaTags = await page.evaluate(() => {
    return {
      theme_color: document.querySelector('meta[name="theme-color"]')?.content,
      apple_mobile_web_app_capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content,
      apple_mobile_web_app_title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content
    };
  });
  console.log('Meta tags:', JSON.stringify(metaTags));

  console.log('Step 7: Take screenshot...');
  await page.screenshot({ path: '/tmp/verify_pwa.png', fullPage: true });
  console.log('Screenshot saved to /tmp/verify_pwa.png');

  await browser.close();
  console.log('\n=== PWA verification complete ===');
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
