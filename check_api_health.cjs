const http = require('http');

http.get('http://localhost:3001/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Backend API Health:', res.statusCode);
    try {
      console.log('Response:', JSON.parse(data));
    } catch(e) {
      console.log('Response:', data);
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});

http.get('http://localhost:5400', (res) => {
  console.log('Frontend: Status', res.statusCode);
}).on('error', (err) => {
  console.log('Frontend Error:', err.message);
});
