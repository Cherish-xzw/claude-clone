const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'claude-clone.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    name TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    preferences TEXT DEFAULT '{}',
    custom_instructions TEXT DEFAULT ''
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#CC785C',
    custom_instructions TEXT DEFAULT '',
    knowledge_base_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_archived INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    project_id TEXT,
    title TEXT,
    model TEXT DEFAULT 'claude-sonnet-4-5-20250929',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME,
    is_archived INTEGER DEFAULT 0,
    is_pinned INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    is_unread INTEGER DEFAULT 0,
    settings TEXT DEFAULT '{}',
    token_count INTEGER DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME,
    tokens INTEGER DEFAULT 0,
    finish_reason TEXT,
    images TEXT DEFAULT '[]',
    parent_message_id TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
    id TEXT PRIMARY KEY,
    message_id TEXT,
    conversation_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    identifier TEXT,
    language TEXT,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Shared conversations table
CREATE TABLE IF NOT EXISTS shared_conversations (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    share_token TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    view_count INTEGER DEFAULT 0,
    is_public INTEGER DEFAULT 0,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Prompt library table
CREATE TABLE IF NOT EXISTS prompt_library (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    title TEXT NOT NULL,
    description TEXT,
    prompt_template TEXT NOT NULL,
    category TEXT,
    tags TEXT DEFAULT '[]',
    is_public INTEGER DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Conversation folders table
CREATE TABLE IF NOT EXISTS conversation_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    project_id TEXT,
    name TEXT NOT NULL,
    parent_folder_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    position INTEGER DEFAULT 0
);

-- Conversation folder items table
CREATE TABLE IF NOT EXISTS conversation_folder_items (
    id TEXT PRIMARY KEY,
    folder_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    FOREIGN KEY (folder_id) REFERENCES conversation_folders(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    conversation_id TEXT,
    message_id TEXT,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_estimate REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT DEFAULT 'default',
    key_name TEXT,
    api_key_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used_at DATETIME,
    is_active INTEGER DEFAULT 1
);

-- Project knowledge base files table
CREATE TABLE IF NOT EXISTS project_knowledge_base (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER DEFAULT 0,
    file_path TEXT,
    file_data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
`);

// Insert default project
const insertProject = db.prepare(`
INSERT OR IGNORE INTO projects (id, name, description, color)
VALUES (?, ?, ?, ?)
`);
insertProject.run('default', 'My Project', 'Default project for organizing conversations', '#CC785C');

db.close();
console.log('Database initialized successfully at ' + dbPath);
