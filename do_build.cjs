const { execSync } = require('child_process');
process.chdir('/private/tmp/autonomous-coding/generations/todo-app/client');
console.log('Building client...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build completed!');
} catch (e) {
  console.error('Build failed:', e.message);
  process.exit(1);
}
