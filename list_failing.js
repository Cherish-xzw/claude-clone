const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/private/tmp/autonomous-coding/generations/todo-app/feature_list.json', 'utf8'));
const failing = data.filter(f => !f.passes);
console.log('Total failing tests:', failing.length);
failing.forEach((f, i) => {
  console.log((i+1) + '. ' + f.category + ': ' + f.description);
});
