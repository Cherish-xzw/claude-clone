const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5174,
  path: '/api/conversations',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data.substring(0, 500));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(JSON.stringify({ model: 'claude-sonnet-4-5-20250929' }));
req.end();
