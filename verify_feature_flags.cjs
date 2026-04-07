const puppeteer = require('puppeteer');
const path = require('path');

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
  await new Promise(r => setTimeout(r, 3000));

  console.log('2. Looking for Settings button...');
  // Click on the Settings button by text
  const settingsButtons = await page.$$('button');
  for (const btn of settingsButtons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.trim() === 'Settings') {
      console.log('   Found Settings button, clicking...');
      await btn.click();
      await new Promise(r => setTimeout(r, 2000));
      break;
    }
  }

  console.log('\n3. Looking for Feature Flags button...');
  // RE-QUERY buttons after modal opened
  const allButtons = await page.$$('button');
  let clickedFF = false;
  for (const btn of allButtons) {
    const text = await btn.evaluate(el => el.textContent);
    if (text.trim() === 'Feature Flags') {
      console.log('   Found Feature Flags button, clicking...');
      await btn.click();
      clickedFF = true;
      await new Promise(r => setTimeout(r, 3000));
      break;
    }
  }

  if (!clickedFF) {
    console.log('   Feature Flags button NOT found');
    // Debug: list all buttons
    const btnTexts = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()));
    console.log('   All buttons:', btnTexts.filter(t => t.length > 0).slice(0, 20));
  }

  // Get content
  console.log('\n4. Checking Feature Flags content...');
  const content = await page.evaluate(() => {
    const modals = document.querySelectorAll('[class*="fixed"]');
    for (const modal of modals) {
      const text = modal.innerText;
      if (text.includes('Feature Flags')) {
        return text;
      }
    }
    return null;
  });

  if (content) {
    console.log('   Content preview:', content.replace(/\n/g, ' | ').substring(0, 500));
  } else {
    console.log('   No modal content found');
  }

  // Screenshot
  const screenshotPath = path.join(__dirname, 'verification', 'feature-flags-test.png');
  await page.screenshot({ path: screenshotPath });
  console.log('\n   Screenshot saved to:', screenshotPath);

  // Check for success
  const success = content && (content.includes('Enabled:') || content.includes('advanced_search'));
  console.log('\n=== RESULT:', success ? 'PASSING' : 'NEEDS ATTENTION', '===');

  await browser.close();
  process.exit(success ? 0 : 1);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
