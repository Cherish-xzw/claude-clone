const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Get the PID of the running server
const pidFile = path.join(__dirname, 'server.pid');

try {
  // Kill the old process using Node
  const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
  if (pid) {
    console.log('Killing old server process:', pid);
    process.kill(pid, 'SIGTERM');
  }
} catch (e) {
  // Try to find process by port
  console.log('Finding process on port 3001...');
}

// Start new server
console.log('Starting new server...');
const serverPath = path.join(__dirname, 'server', 'index.js');
const logFile = path.join(__dirname, 'logs', 'backend-new.log');

// Make sure logs directory exists
if (!fs.existsSync(path.join(__dirname, 'logs'))) {
  fs.mkdirSync(path.join(__dirname, 'logs'));
}

// Start the server in background
const { spawn } = require('child_process');
const server = spawn('node', [serverPath], {
  detached: true,
  stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')]
});

// Save PID
fs.writeFileSync(pidFile, server.pid.toString());

server.unref();
console.log('Server started with PID:', server.pid);
console.log('Logs at:', logFile);

// Wait a moment then test
setTimeout(() => {
  http.get('http://localhost:3001/api/feature-flags', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data.substring(0, 300));
    });
  }).on('error', e => console.log('Error:', e.message));
}, 2000);
