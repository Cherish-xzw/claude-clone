const http = require('http');

// Test the POST /api/conversations endpoint through the Vite proxy
const postData = JSON.stringify({
  model: 'claude-sonnet-4-5-20250929'
});

const options = {
  hostname: 'localhost',
  port: 5174,
  path: '/api/conversations',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing POST /api/conversations via Vite proxy...');

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data.substring(0, 1000));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
