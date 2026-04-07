// Kill serve_dist process (77860) and restart with proxy
try {
  process.kill(77860, 'SIGTERM');
  console.log('Killed old serve_dist process');
} catch(e) {
  console.log('Error killing process:', e.message);
}

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

setTimeout(() => {
  console.log('Starting new serve_dist with API proxy...');
  const servePath = path.join(__dirname, 'serve_dist.cjs');
  const logFile = path.join(__dirname, 'logs', 'serve.log');

  const serve = spawn('node', [servePath], {
    detached: true,
    stdio: ['ignore', fs.openSync(logFile, 'w'), fs.openSync(logFile, 'a')]
  });

  serve.unref();
  console.log('Started with PID:', serve.pid);
}, 1000);
