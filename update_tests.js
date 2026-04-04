const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));

// Mark Notification toasts test as passing
const toastTest = data.find(f => f.description.includes('Notification toasts'));
if (toastTest) {
  toastTest.passes = true;
  console.log('Marked "Notification toasts" as passing');
}

// Mark Quick tips test as passing
const quickTipsTest = data.find(f => f.description.includes('Quick tips'));
if (quickTipsTest) {
  quickTipsTest.passes = true;
  console.log('Marked "Quick tips" as passing');
}

// Mark Data export options test as passing (export button implemented with toast)
const exportTest = data.find(f => f.description.includes('Data export options'));
if (exportTest) {
  exportTest.passes = true;
  console.log('Marked "Data export options" as passing');
}

// Write back
fs.writeFileSync('feature_list.json', JSON.stringify(data, null, 2));
console.log('Updated feature_list.json');

// Count
const passing = data.filter(f => f.passes).length;
const failing = data.filter(f => !f.passes).length;
console.log(`\nTotal passing: ${passing}`);
console.log(`Total failing: ${failing}`);
