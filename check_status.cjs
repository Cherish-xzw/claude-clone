const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
const passing = data.filter(f => f.passes).length;
const failing = data.filter(f => !f.passes).length;
console.log('Total features:', data.length);
console.log('Passing:', passing);
console.log('Failing:', failing);
