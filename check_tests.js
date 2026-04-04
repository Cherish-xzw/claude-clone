const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));

// Check multiple features
const features = [
  'Notification',
  'toast',
  'Language',
  'Mobile',
  'Responsive',
  'Data export',
  'Notification toasts'
];

features.forEach(term => {
  const found = data.find(f => f.description.toLowerCase().includes(term.toLowerCase()));
  if (found) {
    console.log(found.description.substring(0, 80));
    console.log('  Passes:', found.passes);
    console.log('');
  }
});
