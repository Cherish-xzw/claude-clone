const http = require('http');

function checkApp() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://localhost:5180', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          hasHtml: data.includes('<html'),
          hasRoot: data.includes('id="root"'),
          hasScript: data.includes('<script'),
          bodyLength: data.length
        });
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

checkApp()
  .then(result => {
    console.log('App Check Results:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.log('Error:', err.message);
  });
