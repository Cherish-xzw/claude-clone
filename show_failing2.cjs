const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
const failing = data.filter((f, i) => !f.passes);
console.log('Total failing tests:', failing.length);
failing.forEach((f, i) => {
  console.log('\n--- Test ' + (i+1) + ' ---');
  console.log('Full object:', JSON.stringify(f, null, 2));
});
