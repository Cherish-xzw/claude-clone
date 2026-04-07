const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
  });

  console.log('1. Navigating to app...');
  await page.goto('http://localhost:5400', { waitUntil: 'networkidle0' });

  // Set isLoggedIn to bypass login
  await page.evaluate(() => {
    localStorage.setItem('isLoggedIn', 'true');
  });

  // Reload to apply the login state
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 3000));

  console.log('2. Checking console logs for WebSocket messages...');
  const wsLogs = consoleLogs.filter(log =>
    log.text.includes('WebSocket') ||
    log.text.includes('ws://') ||
    log.text.includes('connected')
  );

  console.log('\n=== WebSocket Console Logs ===');
  wsLogs.forEach(log => console.log(`[${log.type}] ${log.text}`));

  // Check WebSocket status via API
  const http = require('http');
  const get = (url) => new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  console.log('\n3. Checking WebSocket server status...');
  const status = await get('http://localhost:3001/api/ws-status');
  console.log('   Connected clients:', status.connectedClients);
  console.log('   Channels:', status.channels);

  console.log('\n=== RESULTS ===');
  const wsConnected = status.connectedClients > 0;
  const hasWsLogs = wsLogs.length > 0;
  console.log('WebSocket connected:', wsConnected ? 'YES' : 'NO');
  console.log('WebSocket console logs:', hasWsLogs ? 'YES' : 'NO');

  if (wsConnected || hasWsLogs) {
    console.log('\n=== WebSocket TEST: PASSING ===');
    await browser.close();
    process.exit(0);
  } else {
    console.log('\n=== WebSocket TEST: NEEDS ATTENTION ===');
    await browser.close();
    process.exit(1);
  }
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
