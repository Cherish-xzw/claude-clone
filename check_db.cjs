const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'server', 'data', 'claude-clone.db');
const db = new Database(dbPath);

console.log('Checking database...');

// Check tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

// Check conversations table columns
try {
  const columns = db.prepare("PRAGMA table_info(conversations)").all();
  console.log('\nConversations columns:');
  columns.forEach(col => {
    console.log(`  ${col.name}: ${col.type}`);
  });
} catch (e) {
  console.log('Error checking conversations table:', e.message);
}

// Try to insert
console.log('\nTrying to insert...');
try {
  const result = db.prepare(`
    INSERT INTO conversations (id, title, model, project_id, user_id)
    VALUES (?, ?, ?, ?, ?)
  `).run('test-id-123', null, 'claude-sonnet-4-5-20250929', 'default', 'default');
  console.log('Insert successful!');
} catch (e) {
  console.log('Insert error:', e.message);
}

db.close();
