const fs = require('fs');
const features = JSON.parse(fs.readFileSync('/private/tmp/autonomous-coding/generations/todo-app/feature_list.json', 'utf8'));

// Find project-related tests
const projectTests = features.filter(f =>
  f.description.toLowerCase().includes('project')
);

console.log('Project related tests:');
projectTests.forEach((f, i) => {
  console.log((i+1) + '. [' + f.category + '] ' + f.description);
  console.log('   Steps:', f.steps.join(' -> '));
  console.log('   Passes:', f.passes);
  console.log('');
});
