const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  let errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:5174', {waitUntil: 'load', timeout: 30000});
  await new Promise(r => setTimeout(r, 3000));
  await page.evaluate(() => localStorage.setItem('isLoggedIn', 'true'));
  await page.reload({waitUntil: 'networkidle0'});
  await new Promise(r => setTimeout(r, 3000));
  console.log('Errors containing toLowerCase:', errors.filter(e => e.includes('toLowerCase')));
  console.log('All errors:', errors);
  await browser.close();
})();
