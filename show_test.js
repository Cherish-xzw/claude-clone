const fs = require('fs');
const features = JSON.parse(fs.readFileSync('/private/tmp/autonomous-coding/generations/todo-app/feature_list.json', 'utf8'));

// Find login-related tests
const loginTests = features.filter(f =>
  f.description.toLowerCase().includes('login') ||
  f.description.toLowerCase().includes('auth')
);

console.log('Login/Auth related tests:');
loginTests.forEach((f, i) => {
  console.log((i+1) + '. [' + f.category + '] ' + f.description);
  console.log('   Steps:', f.steps.join(' -> '));
  console.log('   Passes:', f.passes);
  console.log('');
});
