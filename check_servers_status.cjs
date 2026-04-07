const http = require('http');

function checkServer(url, name) {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      console.log(`${name}: Status ${res.statusCode}`);
      resolve(res.statusCode === 200);
    }).on('error', () => {
      console.log(`${name}: Not running`);
      resolve(false);
    });
  });
}

async function main() {
  const backendOk = await checkServer('http://localhost:3001/health', 'Backend (3001)');
  const frontendOk = await checkServer('http://localhost:5400', 'Frontend (5400)');
  process.exit(backendOk && frontendOk ? 0 : 1);
}

main();
