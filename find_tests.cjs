const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));
data.forEach((f, i) => {
  if (!f.passes) {
    console.log('Index:', i);
    console.log(JSON.stringify(f, null, 2));
    console.log('---');
  }
});
