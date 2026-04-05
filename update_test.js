const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json'));

const idx = data.findIndex(t => t.description === 'Project knowledge base upload');
console.log('Found test at index:', idx);
console.log('Current status:', data[idx].passes);

if (idx !== -1 && !data[idx].passes) {
  data[idx].passes = true;
  fs.writeFileSync('feature_list.json', JSON.stringify(data, null, 2));
  console.log('Updated test to passes: true');
} else {
  console.log('Test not found or already passing');
}
