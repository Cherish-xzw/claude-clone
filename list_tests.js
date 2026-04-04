const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
const failing = data.filter(f => !f.passes).slice(0, 30);
failing.forEach((f, i) => console.log((i+1) + '. [' + f.category + '] ' + f.description.substring(0, 100)));
