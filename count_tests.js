const f = require('./feature_list.json');
const t = Array.isArray(f) ? f : [];
console.log('Total tests:', t.length);
const passing = t.filter(x => x.passes).length;
const failing = t.filter(x => !x.passes).length;
console.log('Passing:', passing);
console.log('Failing:', failing);
