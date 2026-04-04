const fs = require('fs');
const features = JSON.parse(fs.readFileSync('/private/tmp/autonomous-coding/generations/todo-app/feature_list.json', 'utf8'));
const passing = features.filter(f => f.passes).length;
const failing = features.filter(f => !f.passes).length;
console.log('Passing:', passing, 'Failing:', failing);
console.log('\nFirst 15 failing tests:');
features.filter(f => !f.passes).slice(0, 15).forEach((f, i) => {
  console.log((i+1) + '. [' + f.category + '] ' + f.description);
});
