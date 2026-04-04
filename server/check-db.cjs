const Database = require('better-sqlite3');
const db = new Database('/private/tmp/autonomous-coding/generations/todo-app/generations/generations/server/data/claude-clone.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(r => r.name).join(', '));
db.close();
