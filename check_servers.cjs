const http = require('http');

// Check frontend (port 5174)
http.get('http://localhost:5174', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Frontend (5174): Status', res.statusCode);
    console.log('Content preview:', data.substring(0, 200));
  });
}).on('error', e => console.log('Frontend (5174): Error -', e.message));

// Check backend (port 3001)
http.get('http://localhost:3001/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Backend (3001): Status', res.statusCode);
    console.log('Health:', data);
  });
}).on('error', e => console.log('Backend (3001): Error -', e.message));
