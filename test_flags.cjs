const http = require('http');

http.get('http://localhost:3001/api/feature-flags', res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data.substring(0, 500));
  });
}).on('error', e => console.log('Error:', e.message));
