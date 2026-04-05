const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json'));
let count = 0;
data.forEach((item, i) => {
  if (!item.passes) {
    console.log((count+1) + '. Test ' + (i+1) + ': ' + item.category + ' - ' + item.description);
    count++;
  }
});
console.log('\nTotal failing: ' + count);
