const { execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Get PID from lsof output
function getPid(port) {
  try {
    const output = execSync(`lsof -i :${port} -t 2>/dev/null`, { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    return lines[0] ? parseInt(lines[0].trim()) : null;
  } catch {
    return null;
  }
}

const PORT = 3001;
const pidFile = path.join(__dirname, 'server.pid');
const logFile = path.join(__dirname, 'logs', 'backend-new.log');

// Get current PID
const currentPid = getPid(PORT);
console.log('Current server on port', PORT, 'has PID:', currentPid);

if (currentPid) {
  console.log('Killing process...');
  try {
    process.kill(currentPid, 'SIGTERM');
    console.log('Process killed');
  } catch (e) {
    console.log('Error killing:', e.message);
  }
}

console.log('Starting new server...');
const serverPath = path.join(__dirname, 'server', 'index.js');

// Start the server
const { spawn } = require('child_process');
const server = spawn('node', [serverPath], {
  detached: true,
  stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')]
});

fs.writeFileSync(pidFile, server.pid.toString());
server.unref();

console.log('Server started with PID:', server.pid);

// Wait and test
setTimeout(() => {
  http.get('http://localhost:3001/api/session-status', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('\nSession status endpoint test:');
      console.log('Status:', res.statusCode);
      console.log('Response:', data.substring(0, 500));
    });
  }).on('error', (e) => console.log('Error:', e.message));
}, 3000);
