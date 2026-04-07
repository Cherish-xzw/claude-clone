const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
const failing = data.filter(f => !f.passes);
console.log('Total failing tests:', failing.length);
console.log('\n=== FAILING TESTS DETAILS ===\n');
failing.forEach((f, i) => {
  console.log((i+1) + '. Category: ' + f.category);
  console.log('   Name: ' + f.name);
  console.log('   Description: ' + f.description);
  console.log('   Test Steps: ' + f.testSteps);
  console.log('   Verification: ' + f.verification);
  console.log('');
});
