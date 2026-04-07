const http = require('http');

// Test the POST /api/conversations endpoint with verbose output
const postData = JSON.stringify({
  model: 'claude-sonnet-4-5-20250929'
});

console.log('Testing POST /api/conversations...');
console.log('Data:', postData);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/conversations',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Accept': 'application/json',
    'Origin': 'http://localhost:5400'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers));
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data.substring(0, 2000));
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(postData);
req.end();
