import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Test endpoint to check connectivity
app.post('/api/test', (req, res) => {
  console.log('=== TEST ENDPOINT CALLED ===');
  console.log('Body:', req.body);
  res.json({ success: true, body: req.body });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const startTime = Date.now();
  try {
    // Check database connectivity
    db.prepare('SELECT 1').get();
    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: responseTime,
      database: 'connected',
      version: '1.0.0'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Rate limiting state
let rateLimitState = {
  isLimited: false,
  retryAfter: null,
  limitedAt: null,
  limitType: null
};

// GET /api/rate-limit-status - Get current rate limit status
app.get('/api/rate-limit-status', (req, res) => {
  res.json({
    isLimited: rateLimitState.isLimited,
    retryAfter: rateLimitState.retryAfter,
    limitedAt: rateLimitState.limitedAt,
    limitType: rateLimitState.limitType
  });
});

// Simple non-streaming chat endpoint
app.post('/api/chat', async (req, res) => {
  console.log('=== CHAT ENDPOINT CALLED ===');
  console.log('Body:', JSON.stringify(req.body));
  try {
    const { content, images = [], model = 'claude-sonnet-4-5-20250929', custom_instructions = '', temperature = 0.7, top_p = 1.0, max_tokens = 4096, system_prompt } = req.body;

    const systemPrompt = system_prompt || custom_instructions || "You are Claude, a helpful AI assistant.";

    // Build user message content with images if present
    let userMessageContent;
    if (images && images.length > 0) {
      userMessageContent = images.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.type || 'image/jpeg',
          data: img.data.split(',')[1]
        }
      }));
      if (content && content.trim()) {
        userMessageContent.unshift({ type: 'text', text: content });
      }
    } else {
      userMessageContent = content;
    }

    let response;
    try {
      response = await anthropic.messages.create({
        model: model,
        max_tokens: parseInt(max_tokens),
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessageContent }],
        temperature: parseFloat(temperature),
        top_p: parseFloat(top_p),
      });
    } catch (apiError) {
      // Check if this is a rate limit error
      const errorStatus = apiError?.status || apiError?.response?.status;
      const errorType = apiError?.type || '';

      if (errorStatus === 429 || errorType === 'rate_limit_error' || errorType === 'overloaded_error') {
        // Extract retry-after from error response if available
        const retryAfter = apiError?.response?.headers?.['retry-after'] ||
                          apiError?.response?.headers?.get?.('retry-after') ||
                          60;

        const retryAfterSeconds = parseInt(retryAfter) || 60;

        // Update rate limit state
        rateLimitState = {
          isLimited: true,
          retryAfter: retryAfterSeconds,
          limitedAt: new Date().toISOString(),
          limitType: errorType || 'rate_limit'
        };

        console.log(`Rate limit hit in non-streaming endpoint. Retry after ${retryAfterSeconds} seconds.`);
        return res.status(429).json({
          error: 'API rate limit exceeded. Please wait before sending another message.',
          retryAfter: retryAfterSeconds,
          retryAfterDate: new Date(Date.now() + retryAfterSeconds * 1000).toISOString(),
          isRateLimitError: true
        });
      }

      // For other errors, re-throw
      throw apiError;
    }

    console.log('Claude response:', response.content[0].text.substring(0, 100));
    res.json({
      response: response.content[0].text,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize database
const dbPath = path.join(__dirname, 'data', 'claude-clone.db');
const db = new Database(dbPath);

// Add is_unread column if it doesn't exist (migration for existing databases)
try {
  const columns = db.prepare("PRAGMA table_info(conversations)").all();
  const hasUnreadColumn = columns.some(col => col.name === 'is_unread');
  if (!hasUnreadColumn) {
    db.exec("ALTER TABLE conversations ADD COLUMN is_unread INTEGER DEFAULT 0");
    console.log('Added is_unread column to conversations table');
  }
  // Add system_prompt column if it doesn't exist (migration for conversation-specific system prompts)
  const hasSystemPromptColumn = columns.some(col => col.name === 'system_prompt');
  if (!hasSystemPromptColumn) {
    db.exec("ALTER TABLE conversations ADD COLUMN system_prompt TEXT DEFAULT ''");
    console.log('Added system_prompt column to conversations table');
  }
  // Add is_favorited column if it doesn't exist (migration for bookmark/favorite feature)
  const hasFavoritedColumn = columns.some(col => col.name === 'is_favorited');
  if (!hasFavoritedColumn) {
    db.exec("ALTER TABLE conversations ADD COLUMN is_favorited INTEGER DEFAULT 0");
    console.log('Added is_favorited column to conversations table');
  }
} catch (error) {
  console.error('Migration error:', error);
}

// Add usage_count column to prompt_library if it doesn't exist
try {
  const promptColumns = db.prepare("PRAGMA table_info(prompt_library)").all();
  const hasUsageCountColumn = promptColumns.some(col => col.name === 'usage_count');
  if (!hasUsageCountColumn) {
    db.exec("ALTER TABLE prompt_library ADD COLUMN usage_count INTEGER DEFAULT 0");
    console.log('Added usage_count column to prompt_library table');
  }
} catch (error) {
  console.error('Prompt library migration error:', error);
}

// Create message_reactions table if it doesn't exist
try {
  const reactionsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='message_reactions'").get();
  if (!reactionsTableExists) {
    db.exec(`
      CREATE TABLE message_reactions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        emoji TEXT NOT NULL,
        user_id TEXT DEFAULT 'default',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages(id)
      )
    `);
    console.log('Created message_reactions table');
  }
} catch (error) {
  console.error('Message reactions migration error:', error);
}

// Create feature_flags table if it doesn't exist
try {
  const featureFlagsTableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='feature_flags'").get();
  if (!featureFlagsTableExists) {
    db.exec(`
      CREATE TABLE feature_flags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        enabled INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Created feature_flags table');

    // Insert default feature flags
    const insertStmt = db.prepare(`
      INSERT INTO feature_flags (id, name, description, enabled, is_public)
      VALUES (?, ?, ?, ?, ?)
    `);

    const defaultFlags = [
      { id: generateId(), name: 'new_artifact_preview', description: 'Show preview panel for new artifacts', enabled: 1, is_public: 1 },
      { id: generateId(), name: 'enhanced_markdown', description: 'Enhanced markdown rendering with more features', enabled: 1, is_public: 1 },
      { id: generateId(), name: 'voice_input', description: 'Voice input functionality', enabled: 0, is_public: 1 },
      { id: generateId(), name: 'beta_features', description: 'Enable beta/experimental features', enabled: 0, is_public: 1 },
      { id: generateId(), name: 'analytics_dashboard', description: 'Show usage analytics dashboard', enabled: 1, is_public: 1 },
      { id: generateId(), name: 'collaborative_editing', description: 'Real-time collaborative editing (mock)', enabled: 0, is_public: 0 },
      { id: generateId(), name: 'advanced_search', description: 'Advanced search capabilities', enabled: 1, is_public: 1 },
      { id: generateId(), name: 'custom_themes', description: 'Custom theme creation and management', enabled: 0, is_public: 1 }
    ];

    for (const flag of defaultFlags) {
      insertStmt.run(flag.id, flag.name, flag.description, flag.enabled, flag.is_public);
    }
    console.log('Inserted default feature flags');
  }
} catch (error) {
  console.error('Feature flags migration error:', error);
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '',
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
});

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ============== CONVERSATIONS ==============

// GET /api/conversations - List all conversations
app.get('/api/conversations', (req, res) => {
  try {
    const { favorites, project_id, archived } = req.query;
    let query = `SELECT * FROM conversations WHERE is_deleted = 0`;
    const params = [];

    // Filter by favorites
    if (favorites === 'true') {
      query += ` AND is_favorited = 1`;
    }

    // Filter by project
    if (project_id) {
      query += ` AND project_id = ?`;
      params.push(project_id);
    }

    // Filter by archived status
    if (archived === 'true') {
      query += ` AND is_archived = 1`;
    } else if (archived === 'false') {
      query += ` AND is_archived = 0`;
    }

    query += ` ORDER BY updated_at DESC`;

    const conversations = db.prepare(query).all(...params);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// POST /api/conversations - Create new conversation
app.post('/api/conversations', (req, res) => {
  try {
    const id = generateId();
    const { title, model = 'claude-sonnet-4-5-20250929', project_id = 'default' } = req.body;

    db.prepare(`
      INSERT INTO conversations (id, title, model, project_id, user_id)
      VALUES (?, ?, ?, ?, 'default')
    `).run(id, title || null, model, project_id);

    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    res.json(conversation);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// GET /api/conversations/:id - Get single conversation
app.get('/api/conversations/:id', (req, res) => {
  try {
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// PUT /api/conversations/:id - Update conversation
app.put('/api/conversations/:id', (req, res) => {
  try {
    const { title, model, is_pinned, is_archived, is_deleted, is_unread, is_favorited, system_prompt } = req.body;
    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (model !== undefined) { updates.push('model = ?'); values.push(model); }
    if (is_pinned !== undefined) { updates.push('is_pinned = ?'); values.push(is_pinned ? 1 : 0); }
    if (is_archived !== undefined) { updates.push('is_archived = ?'); values.push(is_archived ? 1 : 0); }
    if (is_deleted !== undefined) { updates.push('is_deleted = ?'); values.push(is_deleted ? 1 : 0); }
    if (is_unread !== undefined) { updates.push('is_unread = ?'); values.push(is_unread ? 1 : 0); }
    if (is_favorited !== undefined) { updates.push('is_favorited = ?'); values.push(is_favorited ? 1 : 0); }
    if (system_prompt !== undefined) { updates.push('system_prompt = ?'); values.push(system_prompt); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    res.json(conversation);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// DELETE /api/conversations/:id - Delete conversation
app.delete('/api/conversations/:id', (req, res) => {
  try {
    db.prepare('UPDATE conversations SET is_deleted = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// POST /api/conversations/:id/merge - Merge another conversation into this one
app.post('/api/conversations/:id/merge', (req, res) => {
  try {
    const targetId = req.params.id;
    const { source_conversation_id } = req.body;

    if (!source_conversation_id) {
      return res.status(400).json({ error: 'Source conversation ID is required' });
    }

    if (targetId === source_conversation_id) {
      return res.status(400).json({ error: 'Cannot merge a conversation with itself' });
    }

    // Get source conversation
    const sourceConv = db.prepare('SELECT * FROM conversations WHERE id = ? AND is_deleted = 0').get(source_conversation_id);
    if (!sourceConv) {
      return res.status(404).json({ error: 'Source conversation not found' });
    }

    // Get target conversation
    const targetConv = db.prepare('SELECT * FROM conversations WHERE id = ? AND is_deleted = 0').get(targetId);
    if (!targetConv) {
      return res.status(404).json({ error: 'Target conversation not found' });
    }

    // Get messages from both conversations
    const sourceMessages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(source_conversation_id);
    const targetMessages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(targetId);

    // Combine and sort all messages by created_at
    const allMessages = [...sourceMessages, ...targetMessages].sort((a, b) => {
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Get the earliest created_at from all messages
    const earliestMessage = allMessages[0];
    const latestMessage = allMessages[allMessages.length - 1];

    // Move all messages from source to target
    db.prepare('UPDATE messages SET conversation_id = ? WHERE conversation_id = ?').run(targetId, source_conversation_id);

    // Also move artifacts from source to target
    db.prepare('UPDATE artifacts SET conversation_id = ? WHERE conversation_id = ?').run(targetId, source_conversation_id);

    // Update target conversation metadata
    const totalMessageCount = sourceMessages.length + targetMessages.length;
    db.prepare(`
      UPDATE conversations
      SET message_count = ?,
          last_message_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(totalMessageCount, latestMessage?.created_at || targetConv.last_message_at, targetId);

    // Delete the source conversation
    db.prepare('UPDATE conversations SET is_deleted = 1 WHERE id = ?').run(source_conversation_id);

    res.json({
      success: true,
      merged_conversation_id: targetId,
      messages_moved: sourceMessages.length,
      total_messages: totalMessageCount
    });
  } catch (error) {
    console.error('Error merging conversations:', error);
    res.status(500).json({ error: 'Failed to merge conversations' });
  }
});

// ============== MESSAGES ==============

// GET /api/conversations/:id/messages - Get messages for conversation
app.get('/api/conversations/:id/messages', (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/messages/stream - Stream message response (SSE)
app.post('/api/messages/stream', async (req, res) => {
  console.log('=== Stream request received ===');
  try {
    const { conversation_id, content, images = [], model = 'claude-sonnet-4-5-20250929', custom_instructions = '', temperature = 0.7, top_p = 1.0, max_tokens = 4096, thinking_enabled = false, system_prompt } = req.body;

    // Set up SSE headers FIRST (before API call)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get conversation messages for context
    let conversationMessages = [];
    if (conversation_id) {
      conversationMessages = db.prepare(`
        SELECT role, content, images FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `).all(conversation_id);
    }

    // Build messages array - use system_prompt if provided, otherwise custom_instructions, otherwise default
    const systemPrompt = system_prompt || custom_instructions || "You are Claude, a helpful AI assistant. Respond clearly and concisely.";

    // Build user message content with images if present
    let userMessageContent;
    if (images && images.length > 0) {
      // Claude vision API format for images
      userMessageContent = images.map(img => ({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.type || 'image/jpeg',
          data: img.data.split(',')[1] // Remove data URL prefix if present
        }
      }));
      // Add text content if present
      if (content && content.trim()) {
        userMessageContent.unshift({
          type: 'text',
          text: content
        });
      }
    } else {
      userMessageContent = content;
    }

    // Build messages array with proper format
    const messages = [
      ...conversationMessages.map(m => {
        // Check if the message has images stored
        let msgContent;
        if (m.images) {
          try {
            const storedImages = JSON.parse(m.images);
            if (storedImages && storedImages.length > 0) {
              msgContent = storedImages.map(img => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: img.type || 'image/jpeg',
                  data: img.data.split(',')[1]
                }
              }));
              if (m.content && m.content.trim()) {
                msgContent.unshift({ type: 'text', text: m.content });
              }
            } else {
              msgContent = m.content;
            }
          } catch {
            msgContent = m.content;
          }
        } else {
          msgContent = m.content;
        }
        return {
          role: m.role,
          content: msgContent
        };
      }),
      {
        role: 'user',
        content: userMessageContent
      }
    ];

    console.log('Calling Anthropic API with images:', images.length, 'Thinking enabled:', thinking_enabled);

    // Build API request options
    const apiRequestOptions = {
      model: model,
      max_tokens: parseInt(max_tokens),
      system: systemPrompt,
      messages: messages,
      temperature: parseFloat(temperature),
      top_p: parseFloat(top_p),
    };

    // Add thinking block if enabled
    if (thinking_enabled) {
      apiRequestOptions.thinking = {
        type: 'enabled',
        budget_tokens: 10000
      };
    }

    // Send message to Claude with streaming
    let stream;
    try {
      stream = await anthropic.messages.stream(apiRequestOptions, {
        fetchOptions: {
          signal: req.signal
        }
      });
    } catch (streamError) {
      console.error('Stream error:', streamError);

      // Check if this is a rate limit error
      const errorStatus = streamError?.status || streamError?.response?.status;
      const errorType = streamError?.type || '';

      if (errorStatus === 429 || errorType === 'rate_limit_error' || errorType === 'overloaded_error') {
        // Extract retry-after from error response if available
        const retryAfter = streamError?.response?.headers?.['retry-after'] ||
                          streamError?.response?.headers?.get?.('retry-after') ||
                          60; // Default to 60 seconds

        const retryAfterSeconds = parseInt(retryAfter) || 60;

        // Update rate limit state
        rateLimitState = {
          isLimited: true,
          retryAfter: retryAfterSeconds,
          limitedAt: new Date().toISOString(),
          limitType: errorType || 'rate_limit'
        };

        console.log(`Rate limit hit. Retry after ${retryAfterSeconds} seconds.`);

        // Send rate limit error through SSE
        res.write(`[RATE_LIMIT_ERROR:${JSON.stringify({
          message: 'API rate limit exceeded. Please wait before sending another message.',
          retryAfter: retryAfterSeconds,
          retryAfterDate: new Date(Date.now() + retryAfterSeconds * 1000).toISOString()
        })}]`);
        res.end();
        return;
      }

      // For other errors, throw to the outer catch
      throw streamError;
    }

    console.log('Stream started');

    let fullContent = '';
    let thinkingContent = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let thinkingComplete = false;

    // Process stream chunks
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          res.write(event.delta.text);
        } else if (event.delta.type === 'thinking_delta') {
          // Handle thinking content
          thinkingContent += event.delta.thinking;
          if (!thinkingComplete) {
            // Mark thinking as complete before main content starts
            res.write('\n\n[THINKING_END]\n\n');
            thinkingComplete = true;
          }
        }
      } else if (event.type === 'content_block_start') {
        // If first content block is thinking, send marker
        if (event.content_block.type === 'thinking' && !thinkingComplete) {
          res.write('[THINKING_START]');
        }
      } else if (event.type === 'message_delta') {
        // Capture token usage from message_delta event
        if (event.usage) {
          outputTokens = event.usage.output_tokens || 0;
        }
      } else if (event.type === 'message_start') {
        // Capture input tokens from message_start event
        if (event.message && event.message.usage) {
          inputTokens = event.message.usage.input_tokens || 0;
        }
      }
    }

    // If thinking was present, send it at the end before token usage
    if (thinkingContent) {
      res.write(`\n\n[TABLET_THINKING:${JSON.stringify({ thinking: thinkingContent })}]`);
    }

    // Send token usage at the end of stream
    res.write(`\n\n[TABLET_TOKEN_USAGE:${JSON.stringify({ inputTokens, outputTokens })}]`);

    console.log('Stream complete, saving to DB...');
    console.log(`Token usage - Input: ${inputTokens}, Output: ${outputTokens}`);

    // Save message to database
    if (conversation_id) {
      // Save user message with images
      const imagesJson = images && images.length > 0 ? JSON.stringify(images) : null;
      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, images)
        VALUES (?, ?, 'user', ?, ?)
      `).run(generateId(), conversation_id, content, imagesJson);

      // Save assistant message
      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content)
        VALUES (?, ?, 'assistant', ?)
      `).run(generateId(), conversation_id, fullContent);

      // Update conversation
      db.prepare(`
        UPDATE conversations
        SET updated_at = CURRENT_TIMESTAMP,
            last_message_at = CURRENT_TIMESTAMP,
            title = COALESCE(title, ?),
            message_count = message_count + 2
        WHERE id = ?
      `).run(content.substring(0, 50) + (content.length > 50 ? '...' : ''), conversation_id);
    }

    res.end();
    console.log('=== Stream request complete ===');
  } catch (error) {
    console.error('Error streaming message:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream message' });
    } else {
      res.end();
    }
  }
});

// PUT /api/messages/:id - Update message
app.put('/api/messages/:id', (req, res) => {
  try {
    const { content } = req.body;
    db.prepare(`
      UPDATE messages
      SET content = ?, edited_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content, req.params.id);
    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    res.json(message);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// DELETE /api/messages/:id - Delete message
app.delete('/api/messages/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM messages WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// ============== MESSAGE REACTIONS ==============

// GET /api/messages/:id/reactions - Get reactions for a message
app.get('/api/messages/:id/reactions', (req, res) => {
  try {
    const reactions = db.prepare(`
      SELECT mr.*,
             COUNT(*) as count,
             GROUP_CONCAT(mr.user_id) as user_ids
      FROM message_reactions mr
      WHERE mr.message_id = ?
      GROUP BY mr.emoji
    `).all(req.params.id);
    res.json(reactions);
  } catch (error) {
    console.error('Error fetching reactions:', error);
    res.status(500).json({ error: 'Failed to fetch reactions' });
  }
});

// POST /api/messages/:id/reactions - Add a reaction to a message
app.post('/api/messages/:id/reactions', (req, res) => {
  try {
    const { emoji, user_id = 'default' } = req.body;
    const id = generateId();

    // Check if user already reacted with this emoji
    const existing = db.prepare(`
      SELECT * FROM message_reactions
      WHERE message_id = ? AND emoji = ? AND user_id = ?
    `).get(req.params.id, emoji, user_id);

    if (existing) {
      // Remove the existing reaction (toggle behavior)
      db.prepare('DELETE FROM message_reactions WHERE id = ?').run(existing.id);
      res.json({ removed: true, emoji });
    } else {
      // Add new reaction
      db.prepare(`
        INSERT INTO message_reactions (id, message_id, emoji, user_id)
        VALUES (?, ?, ?, ?)
      `).run(id, req.params.id, emoji, user_id);
      res.json({ added: true, emoji, id });
    }
  } catch (error) {
    console.error('Error adding reaction:', error);
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// DELETE /api/messages/:id/reactions/:emoji - Remove a specific reaction
app.delete('/api/messages/:id/reactions/:emoji', (req, res) => {
  try {
    const { user_id = 'default' } = req.query;
    db.prepare(`
      DELETE FROM message_reactions
      WHERE message_id = ? AND emoji = ? AND user_id = ?
    `).run(req.params.id, decodeURIComponent(req.params.emoji), user_id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing reaction:', error);
    res.status(500).json({ error: 'Failed to remove reaction' });
  }
});

// ============== PROJECTS ==============

// GET /api/projects - List all projects
app.get('/api/projects', (req, res) => {
  try {
    const projects = db.prepare(`
      SELECT * FROM projects
      WHERE is_archived = 0
      ORDER BY created_at DESC
    `).all();
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/projects - Create new project
app.post('/api/projects', (req, res) => {
  try {
    const id = generateId();
    const { name, description, color = '#CC785C', user_id = 'default', custom_instructions = '' } = req.body;

    db.prepare(`
      INSERT INTO projects (id, name, description, color, user_id, custom_instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, description, color, user_id, custom_instructions);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PUT /api/projects/:id - Update project
app.put('/api/projects/:id', (req, res) => {
  try {
    const { name, description, color, custom_instructions, is_pinned, is_archived } = req.body;
    const updates = [];
    const values = [];

    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (color !== undefined) { updates.push('color = ?'); values.push(color); }
    if (custom_instructions !== undefined) { updates.push('custom_instructions = ?'); values.push(custom_instructions); }
    if (is_pinned !== undefined) { updates.push('is_pinned = ?'); values.push(is_pinned ? 1 : 0); }
    if (is_archived !== undefined) { updates.push('is_archived = ?'); values.push(is_archived ? 1 : 0); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
    res.json(project);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/projects/:id - Delete project
app.delete('/api/projects/:id', (req, res) => {
  try {
    db.prepare('UPDATE projects SET is_archived = 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// GET /api/projects/:id/analytics - Get project analytics
app.get('/api/projects/:id/analytics', (req, res) => {
  try {
    const projectId = req.params.id;

    // Get conversation count for this project
    const conversationCount = db.prepare(`
      SELECT COUNT(*) as count FROM conversations WHERE project_id = ?
    `).get(projectId);

    // Get total message count for this project's conversations
    const messageStats = db.prepare(`
      SELECT COUNT(*) as count FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.project_id = ?
    `).get(projectId);

    // Get token usage for this project's conversations
    const tokenStats = db.prepare(`
      SELECT
        SUM(m.input_tokens) as input_tokens,
        SUM(m.output_tokens) as output_tokens,
        SUM(m.input_tokens + m.output_tokens) as total_tokens
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.project_id = ?
    `).get(projectId);

    // Get usage by model
    const usageByModel = db.prepare(`
      SELECT
        c.model,
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(m.id) as message_count,
        SUM(m.input_tokens) as input_tokens,
        SUM(m.output_tokens) as output_tokens
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.project_id = ?
      GROUP BY c.model
    `).all(projectId);

    // Get recent activity (messages in last 7 days)
    const recentActivity = db.prepare(`
      SELECT DATE(m.created_at) as date, COUNT(*) as message_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.project_id = ?
      AND m.created_at >= datetime('now', '-7 days')
      GROUP BY DATE(m.created_at)
      ORDER BY date DESC
    `).all(projectId);

    // Calculate estimated cost
    const pricing = {
      input: 3.75,
      output: 15
    };
    const estimatedCost = (
      ((tokenStats?.input_tokens || 0) / 1000000 * pricing.input) +
      ((tokenStats?.output_tokens || 0) / 1000000 * pricing.output)
    );

    res.json({
      conversation_count: conversationCount?.count || 0,
      message_count: messageStats?.count || 0,
      input_tokens: tokenStats?.input_tokens || 0,
      output_tokens: tokenStats?.output_tokens || 0,
      total_tokens: tokenStats?.total_tokens || 0,
      estimated_cost: estimatedCost,
      usage_by_model: usageByModel,
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Error fetching project analytics:', error);
    res.status(500).json({ error: 'Failed to fetch project analytics' });
  }
});

// ============== PROJECT KNOWLEDGE BASE ==============

// GET /api/projects/:id/knowledge - Get knowledge base files for a project
app.get('/api/projects/:id/knowledge', (req, res) => {
  try {
    const projectId = req.params.id;

    const files = db.prepare(`
      SELECT id, project_id, file_name, file_type, file_size, created_at
      FROM project_knowledge_base
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId);

    res.json({ files });
  } catch (error) {
    console.error('Error fetching knowledge base files:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge base files' });
  }
});

// POST /api/projects/:id/knowledge - Upload file to knowledge base
app.post('/api/projects/:id/knowledge', (req, res) => {
  try {
    const projectId = req.params.id;
    const { file_name, file_type, file_data } = req.body;

    if (!file_name || !file_data) {
      return res.status(400).json({ error: 'file_name and file_data are required' });
    }

    const id = generateId();
    const fileSize = Buffer.from(file_data, 'base64').length;

    db.prepare(`
      INSERT INTO project_knowledge_base (id, project_id, file_name, file_type, file_size, file_data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, projectId, file_name, file_type || 'text/plain', fileSize, file_data);

    const file = db.prepare(`
      SELECT id, project_id, file_name, file_type, file_size, created_at
      FROM project_knowledge_base WHERE id = ?
    `).get(id);

    res.json({ file });
  } catch (error) {
    console.error('Error uploading knowledge base file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// DELETE /api/projects/:id/knowledge/:fileId - Delete knowledge base file
app.delete('/api/projects/:id/knowledge/:fileId', (req, res) => {
  try {
    const { id: projectId, fileId } = req.params;

    const result = db.prepare(`
      DELETE FROM project_knowledge_base WHERE id = ? AND project_id = ?
    `).run(fileId, projectId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting knowledge base file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// ============== ARTIFACTS ==============

// GET /api/artifacts/:id - Get artifact
app.get('/api/artifacts/:id', (req, res) => {
  try {
    const artifact = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(req.params.id);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    res.json(artifact);
  } catch (error) {
    console.error('Error fetching artifact:', error);
    res.status(500).json({ error: 'Failed to fetch artifact' });
  }
});

// POST /api/artifacts - Create artifact
app.post('/api/artifacts', (req, res) => {
  try {
    const id = generateId();
    const { message_id, conversation_id, type, title, identifier, language, content } = req.body;

    db.prepare(`
      INSERT INTO artifacts (id, message_id, conversation_id, type, title, identifier, language, content)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, message_id, conversation_id, type, title, identifier, language, content);

    const artifact = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    res.json(artifact);
  } catch (error) {
    console.error('Error creating artifact:', error);
    res.status(500).json({ error: 'Failed to create artifact' });
  }
});

// PUT /api/artifacts/:id - Update artifact
app.put('/api/artifacts/:id', (req, res) => {
  try {
    const { title, content, version } = req.body;
    const updates = ['updated_at = CURRENT_TIMESTAMP'];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (content !== undefined) { updates.push('content = ?'); values.push(content); }
    if (version !== undefined) { updates.push('version = ?'); values.push(version); }

    values.push(req.params.id);

    db.prepare(`UPDATE artifacts SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const artifact = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(req.params.id);
    res.json(artifact);
  } catch (error) {
    console.error('Error updating artifact:', error);
    res.status(500).json({ error: 'Failed to update artifact' });
  }
});

// DELETE /api/artifacts/:id - Delete artifact
app.delete('/api/artifacts/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM artifacts WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting artifact:', error);
    res.status(500).json({ error: 'Failed to delete artifact' });
  }
});

// ============== SETTINGS ==============

// GET /api/settings - Get user settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = {
      theme: 'system',
      fontSize: 'medium',
      temperature: 0.7,
      maxTokens: 4096,
      defaultModel: 'claude-sonnet-4-5-20250929',
      customInstructions: '',
    };
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/settings - Update user settings
app.put('/api/settings', (req, res) => {
  try {
    res.json(req.body);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============== SHARING ==============

// POST /api/conversations/:id/share - Create share link
app.post('/api/conversations/:id/share', (req, res) => {
  try {
    const shareToken = generateId();
    const { expires_in_days = 30 } = req.body;

    // Calculate expiration date (null if no expiration)
    let expiresAt = null;
    if (expires_in_days > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
    }

    // Delete existing share if any (to allow changing expiration)
    db.prepare('DELETE FROM shared_conversations WHERE conversation_id = ?').run(req.params.id);

    const id = generateId();
    db.prepare(`
      INSERT INTO shared_conversations (id, conversation_id, share_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(id, req.params.id, shareToken, expiresAt ? expiresAt.toISOString() : null);

    const share = db.prepare('SELECT * FROM shared_conversations WHERE id = ?').get(id);
    res.json(share);
  } catch (error) {
    console.error('Error creating share link:', error);
    res.status(500).json({ error: 'Failed to create share link' });
  }
});

// GET /api/share/:token - Get shared conversation
app.get('/api/share/:token', (req, res) => {
  try {
    const share = db.prepare('SELECT * FROM shared_conversations WHERE share_token = ?').get(req.params.token);

    if (!share) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Check if expired (null expires_at means never expires)
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // Get conversation with messages
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(share.conversation_id);
    const messages = db.prepare(`
      SELECT role, content, created_at FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(share.conversation_id);

    // Increment view count
    db.prepare('UPDATE shared_conversations SET view_count = view_count + 1 WHERE id = ?').run(share.id);

    res.json({
      conversation,
      messages,
      share_info: share
    });
  } catch (error) {
    console.error('Error fetching shared conversation:', error);
    res.status(500).json({ error: 'Failed to fetch shared conversation' });
  }
});

// DELETE /api/share/:token - Revoke share link
app.delete('/api/share/:token', (req, res) => {
  try {
    db.prepare('DELETE FROM shared_conversations WHERE share_token = ?').run(req.params.token);
    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking share link:', error);
    res.status(500).json({ error: 'Failed to revoke share link' });
  }
});

// GET /api/conversations/:id/share - Get share info
app.get('/api/conversations/:id/share', (req, res) => {
  try {
    const share = db.prepare('SELECT * FROM shared_conversations WHERE conversation_id = ?').get(req.params.id);
    if (!share) {
      return res.status(404).json({ error: 'No share link exists' });
    }
    res.json(share);
  } catch (error) {
    console.error('Error fetching share info:', error);
    res.status(500).json({ error: 'Failed to fetch share info' });
  }
});

// ============== SEARCH ==============

// GET /api/search/conversations - Search conversations by title
app.get('/api/search/conversations', (req, res) => {
  try {
    const { q = '', project_id, model, date_from, date_to } = req.query;

    let query = `
      SELECT * FROM conversations
      WHERE is_deleted = 0
      AND title LIKE ?
    `;
    const params = [`%${q}%`];

    if (project_id) {
      query += ` AND project_id = ?`;
      params.push(project_id);
    }

    if (model) {
      query += ` AND model = ?`;
      params.push(model);
    }

    if (date_from) {
      query += ` AND created_at >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND created_at <= ?`;
      params.push(date_to);
    }

    query += ` ORDER BY updated_at DESC LIMIT 50`;

    const conversations = db.prepare(query).all(...params);
    res.json(conversations);
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(500).json({ error: 'Failed to search conversations' });
  }
});

// GET /api/search/messages - Search messages across all conversations
app.get('/api/search/messages', (req, res) => {
  try {
    const { q = '', project_id, model, date_from, date_to } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    // Build query to search messages
    let query = `
      SELECT
        m.*,
        c.title as conversation_title,
        c.model as conversation_model,
        c.project_id
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.is_deleted = 0
      AND m.content LIKE ?
    `;
    const params = [`%${q}%`];

    if (project_id) {
      query += ` AND c.project_id = ?`;
      params.push(project_id);
    }

    if (model) {
      query += ` AND c.model = ?`;
      params.push(model);
    }

    if (date_from) {
      query += ` AND m.created_at >= ?`;
      params.push(date_from);
    }

    if (date_to) {
      query += ` AND m.created_at <= ?`;
      params.push(date_to);
    }

    query += ` ORDER BY m.created_at DESC LIMIT 100`;

    const messages = db.prepare(query).all(...params);
    res.json(messages);
  } catch (error) {
    console.error('Error searching messages:', error);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

// GET /api/search - Combined search (conversations and messages)
app.get('/api/search', (req, res) => {
  try {
    const { q = '', type = 'all', project_id, model, date_from, date_to } = req.query;

    const results = {
      conversations: [],
      messages: []
    };

    if (!q || q.length < 2) {
      return res.json(results);
    }

    const likeQuery = `%${q}%`;

    // Search conversations
    if (type === 'all' || type === 'conversations') {
      let convQuery = `
        SELECT * FROM conversations
        WHERE is_deleted = 0
        AND title LIKE ?
      `;
      const convParams = [likeQuery];

      if (project_id) {
        convQuery += ` AND project_id = ?`;
        convParams.push(project_id);
      }

      if (model) {
        convQuery += ` AND model = ?`;
        convParams.push(model);
      }

      if (date_from) {
        convQuery += ` AND created_at >= ?`;
        convParams.push(date_from);
      }

      if (date_to) {
        convQuery += ` AND created_at <= ?`;
        convParams.push(date_to);
      }

      convQuery += ` ORDER BY updated_at DESC LIMIT 20`;

      results.conversations = db.prepare(convQuery).all(...convParams);
    }

    // Search messages
    if (type === 'all' || type === 'messages') {
      let msgQuery = `
        SELECT
          m.*,
          c.title as conversation_title,
          c.model as conversation_model,
          c.project_id
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.is_deleted = 0
        AND m.content LIKE ?
      `;
      const msgParams = [likeQuery];

      if (project_id) {
        msgQuery += ` AND c.project_id = ?`;
        msgParams.push(project_id);
      }

      if (model) {
        msgQuery += ` AND c.model = ?`;
        msgParams.push(model);
      }

      if (date_from) {
        msgQuery += ` AND m.created_at >= ?`;
        msgParams.push(date_from);
      }

      if (date_to) {
        msgQuery += ` AND m.created_at <= ?`;
        msgParams.push(date_to);
      }

      msgQuery += ` ORDER BY m.created_at DESC LIMIT 50`;

      results.messages = db.prepare(msgQuery).all(...msgParams);
    }

    res.json(results);
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// ============== PROMPT LIBRARY ==============

// GET /api/prompts/library - List all saved prompts
app.get('/api/prompts/library', (req, res) => {
  try {
    const prompts = db.prepare(`
      SELECT * FROM prompt_library
      ORDER BY created_at DESC
    `).all();
    res.json(prompts);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

// POST /api/prompts/library - Save a prompt to library
app.post('/api/prompts/library', (req, res) => {
  try {
    const id = generateId();
    const { title, description, prompt_template, category = 'General', tags = '[]' } = req.body;

    db.prepare(`
      INSERT INTO prompt_library (id, title, description, prompt_template, category, tags, user_id)
      VALUES (?, ?, ?, ?, ?, ?, 'default')
    `).run(id, title, description || '', prompt_template, category, tags);

    const prompt = db.prepare('SELECT * FROM prompt_library WHERE id = ?').get(id);
    res.json(prompt);
  } catch (error) {
    console.error('Error saving prompt:', error);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

// GET /api/prompts/library/:id - Get single prompt
app.get('/api/prompts/library/:id', (req, res) => {
  try {
    const prompt = db.prepare('SELECT * FROM prompt_library WHERE id = ?').get(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json(prompt);
  } catch (error) {
    console.error('Error fetching prompt:', error);
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

// PUT /api/prompts/library/:id - Update prompt
app.put('/api/prompts/library/:id', (req, res) => {
  try {
    const { title, description, prompt_template, category, tags } = req.body;
    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (prompt_template !== undefined) { updates.push('prompt_template = ?'); values.push(prompt_template); }
    if (category !== undefined) { updates.push('category = ?'); values.push(category); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(tags); }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    db.prepare(`UPDATE prompt_library SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    const prompt = db.prepare('SELECT * FROM prompt_library WHERE id = ?').get(req.params.id);
    res.json(prompt);
  } catch (error) {
    console.error('Error updating prompt:', error);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

// DELETE /api/prompts/library/:id - Delete prompt
app.delete('/api/prompts/library/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM prompt_library WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// GET /api/prompts/categories - Get all categories
app.get('/api/prompts/categories', (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category FROM prompt_library ORDER BY category
    `).all();
    res.json(categories.map(c => c.category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/prompts/library/:id/use - Increment usage count for a prompt
app.post('/api/prompts/library/:id/use', (req, res) => {
  try {
    db.prepare('UPDATE prompt_library SET usage_count = usage_count + 1 WHERE id = ?').run(req.params.id);
    const prompt = db.prepare('SELECT * FROM prompt_library WHERE id = ?').get(req.params.id);
    if (!prompt) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json(prompt);
  } catch (error) {
    console.error('Error incrementing prompt usage:', error);
    res.status(500).json({ error: 'Failed to increment usage' });
  }
});

// ============== USAGE TRACKING ==============

// GET /api/usage/daily - Get daily usage statistics
app.get('/api/usage/daily', (req, res) => {
  try {
    const { days = 7 } = req.query;

    const dailyStats = db.prepare(`
      SELECT
        DATE(created_at) as date,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        COUNT(*) as message_count
      FROM messages
      WHERE role = 'assistant'
      AND created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).all(parseInt(days));

    // Calculate costs based on model usage
    // For simplicity, we'll use average pricing
    const pricing = {
      input: 3.75, // $3.75 per million input tokens (Sonnet average)
      output: 15   // $15 per million output tokens (Sonnet average)
    };

    const dailyStatsWithCost = dailyStats.map(day => ({
      ...day,
      cost: ((day.input_tokens || 0) / 1000000 * pricing.input +
             (day.output_tokens || 0) / 1000000 * pricing.output)
    }));

    res.json(dailyStatsWithCost);
  } catch (error) {
    console.error('Error fetching daily usage:', error);
    res.status(500).json({ error: 'Failed to fetch daily usage' });
  }
});

// GET /api/usage/monthly - Get monthly usage statistics
app.get('/api/usage/monthly', (req, res) => {
  try {
    const { months = 6 } = req.query;

    const monthlyStats = db.prepare(`
      SELECT
        strftime('%Y-%m', created_at) as month,
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        COUNT(*) as message_count
      FROM messages
      WHERE role = 'assistant'
      AND created_at >= datetime('now', '-' || (? * 30) || ' days')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
    `).all(parseInt(months));

    // Calculate costs based on model usage
    const pricing = {
      input: 3.75, // $3.75 per million input tokens
      output: 15   // $15 per million output tokens
    };

    const monthlyStatsWithCost = monthlyStats.map(month => ({
      ...month,
      cost: ((month.input_tokens || 0) / 1000000 * pricing.input +
             (month.output_tokens || 0) / 1000000 * pricing.output)
    }));

    // Calculate totals
    const totals = monthlyStatsWithCost.reduce((acc, month) => ({
      input_tokens: acc.input_tokens + (month.input_tokens || 0),
      output_tokens: acc.output_tokens + (month.output_tokens || 0),
      message_count: acc.message_count + (month.message_count || 0),
      cost: acc.cost + (month.cost || 0)
    }), { input_tokens: 0, output_tokens: 0, message_count: 0, cost: 0 });

    res.json({
      monthly: monthlyStatsWithCost,
      totals: totals
    });
  } catch (error) {
    console.error('Error fetching monthly usage:', error);
    res.status(500).json({ error: 'Failed to fetch monthly usage' });
  }
});

// GET /api/usage/by-model - Get usage statistics by model
app.get('/api/usage/by-model', (req, res) => {
  try {
    const modelStats = db.prepare(`
      SELECT
        c.model,
        SUM(m.input_tokens) as input_tokens,
        SUM(m.output_tokens) as output_tokens,
        COUNT(m.id) as message_count
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE m.role = 'assistant'
      GROUP BY c.model
      ORDER BY message_count DESC
    `).all();

    // Model-specific pricing
    const modelPricing = {
      'claude-sonnet-4-5-20250929': { input: 3.75, output: 15 },
      'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
      'claude-opus-4-1-20250805': { input: 15, output: 75 }
    };

    const modelStatsWithCost = modelStats.map(stat => {
      const pricing = modelPricing[stat.model] || { input: 3.75, output: 15 };
      return {
        ...stat,
        cost: (stat.input_tokens / 1000000 * pricing.input +
               stat.output_tokens / 1000000 * pricing.output)
      };
    });

    res.json(modelStatsWithCost);
  } catch (error) {
    console.error('Error fetching usage by model:', error);
    res.status(500).json({ error: 'Failed to fetch usage by model' });
  }
});

// GET /api/usage/conversations/:id - Get usage for a specific conversation
app.get('/api/usage/conversations/:id', (req, res) => {
  try {
    const usage = db.prepare(`
      SELECT
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        COUNT(*) as message_count
      FROM messages
      WHERE conversation_id = ?
      AND role = 'assistant'
    `).get(req.params.id);

    // Get conversation info
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    const model = conversation?.model || 'claude-sonnet-4-5-20250929';

    // Calculate cost
    const modelPricing = {
      'claude-sonnet-4-5-20250929': { input: 3.75, output: 15 },
      'claude-haiku-4-5-20251001': { input: 0.80, output: 4 },
      'claude-opus-4-1-20250805': { input: 15, output: 75 }
    };
    const pricing = modelPricing[model] || { input: 3.75, output: 15 };

    res.json({
      ...usage,
      cost: (usage.input_tokens / 1000000 * pricing.input +
             usage.output_tokens / 1000000 * pricing.output),
      model: model
    });
  } catch (error) {
    console.error('Error fetching conversation usage:', error);
    res.status(500).json({ error: 'Failed to fetch conversation usage' });
  }
});

// GET /api/usage/today - Get today's usage summary
app.get('/api/usage/today', (req, res) => {
  try {
    const today = db.prepare(`
      SELECT
        SUM(input_tokens) as input_tokens,
        SUM(output_tokens) as output_tokens,
        COUNT(*) as message_count
      FROM messages
      WHERE role = 'assistant'
      AND DATE(created_at) = DATE('now')
    `).get();

    const pricing = { input: 3.75, output: 15 };

    res.json({
      ...today,
      cost: ((today.input_tokens || 0) / 1000000 * pricing.input +
             (today.output_tokens || 0) / 1000000 * pricing.output)
    });
  } catch (error) {
    console.error('Error fetching today usage:', error);
    res.status(500).json({ error: 'Failed to fetch today usage' });
  }
});

// ============== SESSION MANAGEMENT ==============

// In-memory session storage for demo purposes
// Each session has: id, device, browser, ip, location, lastActive, createdAt
const sessions = new Map();
let currentSessionId = null;

// Generate a session ID
function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Get or create session for current request
function getOrCreateSession(req) {
  let sessionId = req.headers['x-session-id'] || req.headers.cookie?.split(';')
    .find(c => c.trim().startsWith('session_id='))?.split('=')[1];

  if (!sessionId || !sessions.has(sessionId)) {
    sessionId = generateSessionId();
    sessions.set(sessionId, {
      id: sessionId,
      device: req.headers['user-agent']?.includes('Mobile') ? 'Mobile' : 'Desktop',
      browser: getBrowserInfo(req.headers['user-agent']),
      ip: req.ip || req.connection?.remoteAddress || '127.0.0.1',
      location: 'Current Location',
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isCurrent: true
    });
  } else {
    // Update last active
    const session = sessions.get(sessionId);
    session.lastActive = new Date().toISOString();
  }

  currentSessionId = sessionId;
  return sessionId;
}

// Extract browser info from user agent
function getBrowserInfo(userAgent) {
  if (!userAgent) return 'Unknown Browser';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Safari')) return 'Safari';
  if (userAgent.includes('Edge')) return 'Edge';
  return 'Unknown Browser';
}

// GET /api/sessions - Get all active sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessionId = getOrCreateSession(req);
    const allSessions = Array.from(sessions.values()).map(s => ({
      ...s,
      isCurrent: s.id === sessionId
    }));

    // Sort: current session first, then by lastActive
    allSessions.sort((a, b) => {
      if (a.isCurrent) return -1;
      if (b.isCurrent) return 1;
      return new Date(b.lastActive) - new Date(a.lastActive);
    });

    res.json({
      sessions: allSessions,
      currentSessionId: sessionId
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /api/sessions/:id - Logout a specific session
app.delete('/api/sessions/:id', (req, res) => {
  try {
    const sessionId = getOrCreateSession(req);
    const { id } = req.params;

    if (id === sessionId) {
      return res.status(400).json({ error: 'Cannot logout current session. Use logout endpoint instead.' });
    }

    if (!sessions.has(id)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    sessions.delete(id);
    res.json({ success: true, message: 'Session logged out' });
  } catch (error) {
    console.error('Error logging out session:', error);
    res.status(500).json({ error: 'Failed to logout session' });
  }
});

// DELETE /api/sessions/other - Logout all other sessions
app.delete('/api/sessions/other', (req, res) => {
  try {
    const sessionId = getOrCreateSession(req);
    const otherSessionsCount = sessions.size - 1;

    // Delete all sessions except current
    for (const [id] of sessions) {
      if (id !== sessionId) {
        sessions.delete(id);
      }
    }

    res.json({
      success: true,
      message: `Logged out ${otherSessionsCount} other session(s)`,
      loggedOutCount: otherSessionsCount
    });
  } catch (error) {
    console.error('Error logging out other sessions:', error);
    res.status(500).json({ error: 'Failed to logout other sessions' });
  }
});

// POST /api/sessions - Create a new session (simulates login from another device)
app.post('/api/sessions', (req, res) => {
  try {
    const newSessionId = generateSessionId();
    const { device = 'Desktop', browser = 'Unknown Browser' } = req.body;

    const session = {
      id: newSessionId,
      device,
      browser,
      ip: '192.168.1.' + Math.floor(Math.random() * 255),
      location: 'Another Location',
      lastActive: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      isCurrent: false
    };

    sessions.set(newSessionId, session);

    res.json({
      session,
      message: 'New session created (simulating login from another device)'
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ============== HEALTH CHECK ==============

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============== FEATURE FLAGS ==============

// GET /api/feature-flags - Get all feature flags
app.get('/api/feature-flags', (req, res) => {
  try {
    const { public_only } = req.query;
    let query = 'SELECT * FROM feature_flags';
    let params = [];

    if (public_only === 'true') {
      query += ' WHERE is_public = 1';
    }

    query += ' ORDER BY name ASC';
    const flags = db.prepare(query).all(...params);

    res.json({
      flags,
      total: flags.length,
      enabled: flags.filter(f => f.enabled).length,
      disabled: flags.filter(f => !f.enabled).length
    });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    res.status(500).json({ error: 'Failed to fetch feature flags' });
  }
});

// GET /api/feature-flags/:name - Get a specific feature flag
app.get('/api/feature-flags/:name', (req, res) => {
  try {
    const { name } = req.params;
    const flag = db.prepare('SELECT * FROM feature_flags WHERE name = ?').get(name);

    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    res.json(flag);
  } catch (error) {
    console.error('Error fetching feature flag:', error);
    res.status(500).json({ error: 'Failed to fetch feature flag' });
  }
});

// PUT /api/feature-flags/:name - Toggle a feature flag
app.put('/api/feature-flags/:name', (req, res) => {
  try {
    const { name } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'Enabled must be a boolean value' });
    }

    const flag = db.prepare('SELECT * FROM feature_flags WHERE name = ?').get(name);

    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    // Update the flag
    db.prepare(`
      UPDATE feature_flags
      SET enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `).run(enabled ? 1 : 0, name);

    // Get updated flag
    const updatedFlag = db.prepare('SELECT * FROM feature_flags WHERE name = ?').get(name);

    res.json({
      success: true,
      flag: updatedFlag,
      message: `Feature flag '${name}' ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    res.status(500).json({ error: 'Failed to update feature flag' });
  }
});

// POST /api/feature-flags - Create a new feature flag
app.post('/api/feature-flags', (req, res) => {
  try {
    const { name, description, enabled = false, is_public = true } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Name is required and must be a string' });
    }

    // Check if flag already exists
    const existing = db.prepare('SELECT * FROM feature_flags WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ error: 'Feature flag with this name already exists' });
    }

    const id = generateId();
    db.prepare(`
      INSERT INTO feature_flags (id, name, description, enabled, is_public)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description || '', enabled ? 1 : 0, is_public ? 1 : 0);

    const newFlag = db.prepare('SELECT * FROM feature_flags WHERE id = ?').get(id);

    res.status(201).json({
      success: true,
      flag: newFlag,
      message: `Feature flag '${name}' created`
    });
  } catch (error) {
    console.error('Error creating feature flag:', error);
    res.status(500).json({ error: 'Failed to create feature flag' });
  }
});

// DELETE /api/feature-flags/:name - Delete a feature flag
app.delete('/api/feature-flags/:name', (req, res) => {
  try {
    const { name } = req.params;

    const flag = db.prepare('SELECT * FROM feature_flags WHERE name = ?').get(name);
    if (!flag) {
      return res.status(404).json({ error: 'Feature flag not found' });
    }

    db.prepare('DELETE FROM feature_flags WHERE name = ?').run(name);

    res.json({
      success: true,
      message: `Feature flag '${name}' deleted`
    });
  } catch (error) {
    console.error('Error deleting feature flag:', error);
    res.status(500).json({ error: 'Failed to delete feature flag' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
