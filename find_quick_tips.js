const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));

const quickTips = data.find(f => f.description.includes('Quick tips'));
console.log(JSON.stringify(quickTips, null, 2));
