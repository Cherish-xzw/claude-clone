const http = require('http');
http.get('http://localhost:5180', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.substring(0, 3000)));
}).on('error', console.error);
