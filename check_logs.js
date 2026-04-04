const fs = require('fs');
const logDir = '/private/tmp/autonomous-coding/generations/todo-app/logs';
if (fs.existsSync(logDir)) {
  const files = fs.readdirSync(logDir).sort();
  console.log('Recent log files:', files.slice(-3));
  if (files.length > 0) {
    const latest = files[files.length - 1];
    const content = fs.readFileSync(logDir + '/' + latest, 'utf8');
    console.log('Last 3000 chars of', latest + ':');
    console.log(content.slice(-3000));
  }
} else {
  console.log('No logs directory found');
}
