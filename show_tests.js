const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));

const tests = data.filter(f =>
  f.description.includes('Notification toasts') ||
  f.description.includes('Language preferences') ||
  f.description.includes('Data export options')
);

tests.forEach(t => {
  console.log('---');
  console.log(t.description);
  console.log('Steps:', t.steps);
});
