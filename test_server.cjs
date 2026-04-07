// Test server on a different port
const http = require('http');
const fs = require('fs');
const path = require('path');

// Read the original server code
const serverCode = fs.readFileSync(path.join(__dirname, 'server', 'index.js'), 'utf8');

// Create a modified version with different port
const modifiedCode = serverCode
  .replace(/const PORT = process\.env\.PORT \|\| \d+;/, 'const PORT = process.env.PORT || 3099;')
  .replace(/app\.listen\(PORT/, 'app.listen(PORT');

// Write the test server
fs.writeFileSync(path.join(__dirname, 'test_server_instance.js'), modifiedCode);

console.log('Test server written. Starting...');

// Start the server
require(path.join(__dirname, 'test_server_instance.js'));
