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

// Simple non-streaming chat endpoint
app.post('/api/chat', async (req, res) => {
  console.log('=== CHAT ENDPOINT CALLED ===');
  console.log('Body:', JSON.stringify(req.body));
  try {
    const { content, images = [], model = 'claude-sonnet-4-5-20250929', custom_instructions = '', temperature = 0.7, top_p = 1.0, max_tokens = 4096 } = req.body;

    const systemPrompt = custom_instructions || "You are Claude, a helpful AI assistant.";

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

    const response = await anthropic.messages.create({
      model: model,
      max_tokens: parseInt(max_tokens),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessageContent }],
      temperature: parseFloat(temperature),
      top_p: parseFloat(top_p),
    });

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
    const conversations = db.prepare(`
      SELECT * FROM conversations
      WHERE is_deleted = 0
      ORDER BY updated_at DESC
    `).all();
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
    const { title, model, is_pinned, is_archived, is_deleted } = req.body;
    const updates = [];
    const values = [];

    if (title !== undefined) { updates.push('title = ?'); values.push(title); }
    if (model !== undefined) { updates.push('model = ?'); values.push(model); }
    if (is_pinned !== undefined) { updates.push('is_pinned = ?'); values.push(is_pinned ? 1 : 0); }
    if (is_archived !== undefined) { updates.push('is_archived = ?'); values.push(is_archived ? 1 : 0); }
    if (is_deleted !== undefined) { updates.push('is_deleted = ?'); values.push(is_deleted ? 1 : 0); }

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
    const { conversation_id, content, images = [], model = 'claude-sonnet-4-5-20250929', custom_instructions = '', temperature = 0.7, top_p = 1.0, max_tokens = 4096 } = req.body;

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

    // Build messages array
    const systemPrompt = custom_instructions || "You are Claude, a helpful AI assistant. Respond clearly and concisely.";

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

    console.log('Calling Anthropic API with images:', images.length);

    // Send message to Claude with streaming
    const stream = await anthropic.messages.stream({
      model: model,
      max_tokens: parseInt(max_tokens),
      system: systemPrompt,
      messages: messages,
      temperature: parseFloat(temperature),
      top_p: parseFloat(top_p),
    }, {
      fetchOptions: {
        signal: req.signal
      }
    });

    console.log('Stream started');

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    // Process stream chunks
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          res.write(event.delta.text);
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
    const { name, description, color = '#CC785C', user_id = 'default' } = req.body;

    db.prepare(`
      INSERT INTO projects (id, name, description, color, user_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, description, color, user_id);

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

// ============== HEALTH CHECK ==============

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
