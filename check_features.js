const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
const passing = data.filter(f => f.passes);
console.log('Total passing:', passing.length);
console.log('Total failing:', data.filter(f => !f.passes).length);

// Check for specific features
const quickTips = data.find(f => f.description.includes('Quick tips'));
console.log('\nQuick tips test:', quickTips?.passes ? 'PASSING' : 'FAILING');

const responsive = data.find(f => f.description.includes('Responsive layout'));
console.log('Responsive layout test:', responsive?.passes ? 'PASSING' : 'FAILING');

const keyboardNav = data.find(f => f.description.includes('keyboard navigation'));
console.log('Keyboard navigation test:', keyboardNav?.passes ? 'PASSING' : 'FAILING');
