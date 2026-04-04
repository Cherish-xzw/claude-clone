const fs = require('fs');
const data = JSON.parse(fs.readFileSync('feature_list.json', 'utf8'));

const quickTips = data.find(f => f.description.includes('Quick tips'));
const welcomeScreen = data.find(f => f.description.includes('Welcome screen'));
const examplePrompts = data.find(f => f.description.includes('Example prompts'));
const keyboardShortcuts = data.find(f => f.description.includes('Keyboard shortcuts'));

console.log('Quick tips:', quickTips?.passes, '-', quickTips?.description);
console.log('Welcome screen:', welcomeScreen?.passes, '-', welcomeScreen?.description);
console.log('Example prompts:', examplePrompts?.passes, '-', examplePrompts?.description);
console.log('Keyboard shortcuts:', keyboardShortcuts?.passes, '-', keyboardShortcuts?.description);
