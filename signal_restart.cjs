// Send SIGTERM to process 77639 (the running backend server)
try {
  process.kill(77639, 'SIGTERM');
  console.log('Sent SIGTERM to process 77639');
} catch (e) {
  console.log('Could not kill process:', e.code, e.message);
}

// Wait and start new server
setTimeout(() => {
  const { spawn } = require('child_process');
  const path = require('path');
  const fs = require('fs');

  const logFile = path.join(__dirname, 'logs', 'server.log');
  const serverPath = path.join(__dirname, 'server', 'index.js');

  const server = spawn('node', [serverPath], {
    detached: true,
    stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')]
  });

  server.unref();
  console.log('Started new server with PID:', server.pid);
}, 2000);
