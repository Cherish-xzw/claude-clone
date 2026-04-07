const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--disable-web-security']
  });
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    console.log('BROWSER:', msg.type(), msg.text());
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  console.log('1. Navigating to port 5173...');
  await page.goto('http://localhost:5173', {waitUntil: 'load', timeout: 30000});

  console.log('\n2. Waiting for app to load...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n3. Setting login state...');
  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });

  console.log('\n4. Reloading...');
  await page.reload({waitUntil: 'networkidle0'});
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n5. Page content:');
  const content = await page.evaluate(() => {
    return {
      title: document.title,
      bodyHTML: document.body.innerHTML.length,
      rootHTML: document.getElementById('root')?.innerHTML?.length || 0,
      text: document.body.innerText.substring(0, 300)
    };
  });
  console.log(JSON.stringify(content, null, 2));

  await browser.close();
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
