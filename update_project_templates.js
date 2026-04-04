const fs = require('fs');
const features = JSON.parse(fs.readFileSync('/private/tmp/autonomous-coding/generations/todo-app/feature_list.json', 'utf8'));

// Find and update the Project templates test
const projectTemplatesTest = features.find(f => f.description === 'Project templates');
if (projectTemplatesTest) {
  projectTemplatesTest.passes = true;
  console.log('Updated Project templates test to passes: true');
} else {
  console.log('Project templates test not found');
}

// Save the updated file
fs.writeFileSync('/private/tmp/autonomous-coding/generations/todo-app/feature_list.json', JSON.stringify(features, null, 2));
console.log('Done');
