const http = require('http');

console.log('Testing API endpoints...\n');

// Test health check
http.get('http://localhost:3001/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Health check:', res.statusCode === 200 ? 'OK' : 'FAIL');
    console.log(JSON.parse(data));
  });
}).on('error', err => console.log('Health check error:', err.message));

// Test knowledge base endpoint
setTimeout(() => {
  http.get('http://localhost:3001/api/projects/default/knowledge', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\nKnowledge base (GET):', res.statusCode);
      console.log(JSON.parse(data));
    });
  }).on('error', err => console.log('Error:', err.message));
}, 500);

setTimeout(() => {
  console.log('\nTests complete');
  process.exit(0);
}, 2000);
