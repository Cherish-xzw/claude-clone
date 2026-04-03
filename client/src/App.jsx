import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';

// Theme Context
const ThemeContext = createContext();

function useTheme() {
  return useContext(ThemeContext);
}

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// API Base URL
const API_BASE = 'http://localhost:3001/api';

// Models configuration
const MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Best balance of intelligence and speed' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest responses, great for simple tasks' },
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: 'Most capable for complex tasks' },
];

// Icons
const Icons = {
  Plus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Send: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  ),
  Settings: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"></circle>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
    </svg>
  ),
  Moon: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  ),
  Sun: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  ),
  Search: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  ),
  Trash: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    </svg>
  ),
  ChevronDown: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  ),
  Copy: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
    </svg>
  ),
  Stop: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2"></rect>
    </svg>
  ),
  Bot: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"></path>
      <rect x="4" y="8" width="16" height="12" rx="2"></rect>
      <path d="M2 14h2"></path>
      <path d="M20 14h2"></path>
      <path d="M15 13v2"></path>
      <path d="M9 13v2"></path>
    </svg>
  ),
  User: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  ),
  Image: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      <circle cx="8.5" cy="8.5" r="1.5"></circle>
      <polyline points="21 15 16 10 5 21"></polyline>
    </svg>
  ),
  Maximize2: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"></polyline>
      <polyline points="9 21 3 21 3 15"></polyline>
      <line x1="21" y1="3" x2="14" y2="10"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
  ),
  Minimize2: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20"></polyline>
      <polyline points="20 10 14 10 14 4"></polyline>
      <line x1="14" y1="10" x2="21" y2="3"></line>
      <line x1="3" y1="21" x2="10" y2="14"></line>
    </svg>
  ),
  Pin: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"></line>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
    </svg>
  ),
  Pinned: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="17" x2="12" y2="22"></line>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
    </svg>
  ),
  Archive: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"></polyline>
      <rect x="1" y="3" width="22" height="5"></rect>
      <line x1="10" y1="12" x2="14" y2="12"></line>
    </svg>
  ),
  Archived: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"></polyline>
      <rect x="1" y="3" width="22" height="5"></rect>
      <line x1="10" y1="12" x2="14" y2="12"></line>
    </svg>
  ),
  Folder: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  FolderOpen: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1"></path>
      <path d="M2 10h20"></path>
    </svg>
  ),
  ChevronRight: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  ),
  Download: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="7 10 12 15 17 10"></polyline>
      <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
  ),
  Chat: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  Menu: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  ),
  Share: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"></circle>
      <circle cx="6" cy="12" r="3"></circle>
      <circle cx="18" cy="19" r="3"></circle>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
    </svg>
  ),
  Link: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
  ),
};

// Code block component with copy functionality
function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center gap-1 text-xs"
        >
          <Icons.Copy />
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className={`language-${language || 'text'}`}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Message component
function Message({ message, onRegenerate, onEdit, isEditing, editedContent, onEditedContentChange, onSaveEdit, onCancelEdit }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`flex gap-3 max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700'
        }`}>
          {isUser ? <Icons.User /> : <Icons.Bot />}
        </div>
        <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-primary-500 text-white rounded-tr-sm'
              : 'bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
          }`}>
            {isEditing ? (
              <div className="w-full">
                <textarea
                  value={editedContent}
                  onChange={(e) => onEditedContentChange(e.target.value)}
                  className="w-full min-h-[100px] bg-transparent border border-gray-300 dark:border-gray-600 rounded p-2 text-sm text-black dark:text-white"
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={onSaveEdit}
                    className="px-3 py-1 text-xs bg-primary-500 text-white rounded hover:bg-primary-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={onCancelEdit}
                    className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {message.content && (
                  <ReactMarkdown
                    className="markdown-content"
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeHighlight, rehypeRaw]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        if (!inline && match) {
                          return (
                            <CodeBlock
                              language={match[1]}
                              code={String(children).replace(/\n$/, '')}
                            />
                          );
                        }
                        return <code className={className} {...props}>{children}</code>;
                      },
                      pre({ children }) {
                        return <>{children}</>;
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                )}
                {message.isStreaming && (
                  <span className="inline-block ml-1 animate-pulse">▊</span>
                )}
              </>
            )}
          </div>
          {!isUser && !message.isStreaming && !isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => onRegenerate && onRegenerate(message.id)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Regenerate
              </button>
            </div>
          )}
          {isUser && !isEditing && (
            <button
              onClick={() => onEdit && onEdit(message)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Typing indicator
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex gap-3 max-w-3xl">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
          <Icons.Bot />
        </div>
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-100 dark:bg-gray-800">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot"></span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Conversation item in sidebar
function ConversationItem({ conversation, isActive, onClick, onDelete, onPin, onArchive, onMoveToFolder, onDuplicate, onExport, onShare, folders }) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative">
      <div
        onClick={onClick}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isActive
            ? 'bg-gray-200 dark:bg-gray-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate flex items-center gap-1">
            {conversation.is_pinned ? (
              <span className="text-primary-500"><Icons.Pinned /></span>
            ) : null}
            {conversation.title || 'New Conversation'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(conversation.updated_at)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title={conversation.is_pinned ? 'Unpin' : 'Pin'}
        >
          {conversation.is_pinned ? <Icons.Pinned /> : <Icons.Pin />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title={conversation.is_archived ? 'Unarchive' : 'Archive'}
        >
          {conversation.is_archived ? <Icons.Archived /> : <Icons.Archive />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Duplicate"
        >
          <Icons.Copy />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Share"
        >
          <Icons.Share />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExport(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Export"
        >
          <Icons.Download />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMoveMenu(!showMoveMenu);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Move to folder"
        >
          <Icons.Folder />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
        >
          <Icons.Trash />
        </button>
      </div>
      {/* Move to folder dropdown */}
      {showMoveMenu && folders && folders.length > 0 && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50 min-w-40">
          <p className="px-3 py-1 text-xs text-gray-500">Move to folder:</p>
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={(e) => {
                e.stopPropagation();
                onMoveToFolder(conversation.id, folder.id);
                setShowMoveMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-left"
            >
              <Icons.Folder />
              {folder.name}
            </button>
          ))}
          {conversation.project_id && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveToFolder(conversation.id, null);
                setShowMoveMenu(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-left text-gray-500"
            >
              Remove from folder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Model selector dropdown
function ModelSelector({ selectedModel, onModelChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <span>{selectedModelInfo.name}</span>
        <Icons.ChevronDown />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
          {MODELS.map(model => (
            <button
              key={model.id}
              onClick={() => {
                onModelChange(model.id);
                setIsOpen(false);
              }}
              className={`w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                model.id === selectedModel ? 'bg-gray-50 dark:bg-gray-750' : ''
              }`}
            >
              <p className="font-medium text-sm">{model.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{model.description}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Settings modal
function SettingsModal({ isOpen, onClose, temperature, setTemperature, topP, setTopP }) {
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'about', label: 'About' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <div className="w-48 border-r border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-lg mb-4">Settings</h3>
            <nav className="space-y-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-500 text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === 'general' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">General Settings</h4>
                <div>
                  <label className="block text-sm font-medium mb-2">Default Model</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                    {MODELS.map(model => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Temperature: {temperature}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower values are more focused, higher values more creative</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Top P: {topP}</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower values limit response diversity</p>
                </div>
              </div>
            )}
            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">Appearance</h4>
                <div>
                  <label className="block text-sm font-medium mb-2">Theme</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                        theme === 'light' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                    >
                      <Icons.Sun />
                      <p className="text-sm mt-2">Light</p>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                        theme === 'dark' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                    >
                      <Icons.Moon />
                      <p className="text-sm mt-2">Dark</p>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
                        theme === 'system' ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                    >
                      <Icons.Settings />
                      <p className="text-sm mt-2">System</p>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Font Size</label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            )}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">About</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h5 className="font-semibold text-xl mb-2">Claude Clone</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    A clone of the Claude.ai interface built with React and Node.js.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Version 1.0.0
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App component
function App() {
  // State
  const [theme, setTheme] = useState('system');
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedModel, setSelectedModel] = useState('claude-sonnet-4-5-20250929');
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [abortController, setAbortController] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [folders, setFolders] = useState([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedFolders, setExpandedFolders] = useState([]);
  const [showMoveToFolderMenu, setShowMoveToFolderMenu] = useState(false);
  const [movingConversationId, setMovingConversationId] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageContent, setEditedMessageContent] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareData, setShareData] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [sharedView, setSharedView] = useState(null); // For shared conversation view
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadFolders();
  }, []);

  // Check for shared link in URL
  useEffect(() => {
    const path = window.location.pathname;
    const sharedMatch = path.match(/^\/shared\/([a-zA-Z0-9]+)$/);
    if (sharedMatch) {
      const token = sharedMatch[1];
      setSharedLoading(true);
      fetch(`${API_BASE}/share/${token}`)
        .then(res => {
          if (!res.ok) {
            if (res.status === 410) throw new Error('This share link has expired.');
            if (res.status === 404) throw new Error('Share link not found.');
            throw new Error('Failed to load shared conversation.');
          }
          return res.json();
        })
        .then(data => {
          setSharedView(data);
          setSharedLoading(false);
        })
        .catch(err => {
          setSharedError(err.message);
          setSharedLoading(false);
        });
    }
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Command palette keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load conversations from API
  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  // Create new conversation
  const createConversation = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      if (response.ok) {
        const data = await response.json();
        const conversation = data.conversation;
        setConversations(prev => [conversation, ...prev]);
        setCurrentConversation(conversation);
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  // Delete conversation (shows confirmation dialog)
  const deleteConversation = (conversation) => {
    setDeletingConversationId(conversation.id);
    setShowDeleteConfirm(true);
  };

  // Confirm delete conversation
  const confirmDeleteConversation = async () => {
    if (!deletingConversationId) return;
    try {
      const response = await fetch(`${API_BASE}/conversations/${deletingConversationId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== deletingConversationId));
        if (currentConversation?.id === deletingConversationId) {
          setCurrentConversation(null);
          setMessages([]);
        }
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    } finally {
      setShowDeleteConfirm(false);
      setDeletingConversationId(null);
    }
  };

  // Duplicate conversation
  const duplicateConversation = async (conversation) => {
    try {
      // Create new conversation with "Copy of" prefix
      const newConvResponse = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Copy of ${conversation.title || 'New Conversation'}`,
          model: conversation.model || 'claude-sonnet-4-5-20250929',
        }),
      });

      if (newConvResponse.ok) {
        const newConvData = await newConvResponse.json();
        const newConv = newConvData.conversation || newConvData;

        // Add new conversation to list
        setConversations(prev => [newConv, ...prev]);
      }
    } catch (error) {
      console.error('Failed to duplicate conversation:', error);
    }
  };

  // Start editing a message
  const startEditMessage = (message) => {
    setEditingMessageId(message.id);
    setEditedMessageContent(message.content);
  };

  // Save edited message
  const saveEditedMessage = () => {
    if (!editingMessageId) return;
    setMessages(prev => prev.map(msg =>
      msg.id === editingMessageId
        ? { ...msg, content: editedMessageContent }
        : msg
    ));
    setEditingMessageId(null);
    setEditedMessageContent('');
  };

  // Cancel editing message
  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditedMessageContent('');
  };

  // Share conversation via link
  const shareConversation = async (conversation) => {
    try {
      const response = await fetch(`${API_BASE}/conversations/${conversation.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_days: 30 }),
      });
      const data = await response.json();
      if (data.share_token) {
        const link = `${window.location.origin}/shared/${data.share_token}`;
        setShareLink(link);
        setShareData(data);
        setShowShareModal(true);
      }
    } catch (error) {
      console.error('Failed to share conversation:', error);
    }
  };

  // Revoke share link
  const revokeShare = async () => {
    if (!shareData?.share_token) return;
    try {
      await fetch(`${API_BASE}/share/${shareData.share_token}`, { method: 'DELETE' });
      setShowShareModal(false);
      setShareData(null);
      setShareLink('');
    } catch (error) {
      console.error('Failed to revoke share:', error);
    }
  };

  // Export conversation to JSON
  const exportConversation = async (conversation, format = 'json') => {
    try {
      // Get messages for this conversation
      const messagesResponse = await fetch(`${API_BASE}/conversations/${conversation.id}/messages`);
      const messagesData = await messagesResponse.json();
      const messages = messagesData.messages || [];

      if (format === 'markdown') {
        let md = `# ${conversation.title || 'Untitled Conversation'}\n\n`;
        md += `**Model:** ${conversation.model || 'claude-sonnet-4-5-20250929'}\n`;
        md += `**Created:** ${new Date(conversation.created_at).toLocaleString()}\n\n`;
        md += `---\n\n`;
        for (const msg of messages) {
          const role = msg.role === 'user' ? '**User**' : '**Assistant**';
          md += `## ${role}\n\n`;
          md += `${msg.content}\n\n`;
        }
        setExportData(md);
      } else {
        const exportObj = {
          conversation: {
            id: conversation.id,
            title: conversation.title,
            model: conversation.model,
            created_at: conversation.created_at,
            updated_at: conversation.updated_at,
          },
          messages: messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })),
          exported_at: new Date().toISOString(),
        };
        setExportData(JSON.stringify(exportObj, null, 2));
      }
      setExportFormat(format);
      setShowExportModal(true);
    } catch (error) {
      console.error('Failed to export conversation:', error);
    }
  };

  // Update conversation title
  const updateConversationTitle = async (id, newTitle) => {
    try {
      const response = await fetch(`${API_BASE}/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (response.ok) {
        const data = await response.json();
        const updated = data.conversation || data;
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: updated.title } : c));
        if (currentConversation?.id === id) {
          setCurrentConversation(prev => prev ? { ...prev, title: updated.title } : prev);
        }
      }
    } catch (error) {
      console.error('Failed to update conversation:', error);
    }
  };

  // Pin/unpin conversation
  const pinConversation = (conversation) => {
    const newPinned = conversation.is_pinned ? false : true;
    try {
      fetch(`${API_BASE}/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: newPinned }),
      }).then(response => {
        if (response.ok) {
          setConversations(prev => prev.map(c =>
            c.id === conversation.id ? { ...c, is_pinned: newPinned } : c
          ));
          if (currentConversation?.id === conversation.id) {
            setCurrentConversation(prev => prev ? { ...prev, is_pinned: newPinned } : prev);
          }
        }
      });
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  };

  // Archive/unarchive conversation
  const archiveConversation = (conversation) => {
    const newArchived = conversation.is_archived ? false : true;
    try {
      fetch(`${API_BASE}/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: newArchived }),
      }).then(response => {
        if (response.ok) {
          setConversations(prev => prev.map(c =>
            c.id === conversation.id ? { ...c, is_archived: newArchived } : c
          ));
          if (currentConversation?.id === conversation.id) {
            setCurrentConversation(prev => prev ? { ...prev, is_archived: newArchived } : prev);
          }
        }
      });
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  // Load folders
  const loadFolders = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  // Create folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim(), description: '' }),
      });
      if (response.ok) {
        const data = await response.json();
        const folder = data.project || data;
        setFolders(prev => [...prev, folder]);
        setNewFolderName('');
        setShowFolderModal(false);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  // Move conversation to folder
  const moveConversationToFolder = (conversationId, folderId) => {
    try {
      fetch(`${API_BASE}/conversations/${conversationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: folderId }),
      }).then(response => {
        if (response.ok) {
          setConversations(prev => prev.map(c =>
            c.id === conversationId ? { ...c, project_id: folderId } : c
          ));
          if (currentConversation?.id === conversationId) {
            setCurrentConversation(prev => prev ? { ...prev, project_id: folderId } : prev);
          }
        }
      });
    } catch (error) {
      console.error('Failed to move conversation:', error);
    }
    setShowMoveToFolderMenu(false);
    setMovingConversationId(null);
  };

  // Toggle folder expanded state
  const toggleFolder = (folderId) => {
    setExpandedFolders(prev =>
      prev.includes(folderId)
        ? prev.filter(id => id !== folderId)
        : [...prev, folderId]
    );
  };

  // Select conversation
  const selectConversation = async (conversation) => {
    setCurrentConversation(conversation);
    try {
      const response = await fetch(`${API_BASE}/conversations/${conversation.id}/messages`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    // Create conversation if needed
    if (!currentConversation) {
      await createConversation();
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setIsStreaming(true);

    // Create abort controller
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Add streaming message placeholder
      const assistantMessageId = generateId();
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        created_at: new Date().toISOString(),
      }]);

      // Stream response
      const response = await fetch(`${API_BASE}/messages/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: currentConversation?.id,
          content: userMessage.content,
          model: selectedModel,
          temperature: temperature,
          top_p: topP,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullContent += chunk;

        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? { ...msg, content: fullContent }
            : msg
        ));
      }

      // Mark streaming complete
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, isStreaming: false }
          : msg
      ));

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        loadConversations();
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        console.error('Error:', error);
        setMessages(prev => prev.map(msg =>
          msg.isStreaming
            ? { ...msg, content: msg.content + '\n\n[Error: Failed to get response]' }
            : msg
        ));
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);
    }
  };

  // Stop generation
  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  // Handle keyboard input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Filter conversations by search and archived status
  const filteredConversations = conversations.filter(c =>
    (showArchived ? c.is_archived : !c.is_archived) &&
    c.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group conversations by date - uses local time for grouping
  // Pinned conversations appear at the top in a separate "Pinned" section
  const groupConversationsByDate = (convs) => {
    // Separate pinned and unpinned
    const pinned = convs.filter(c => c.is_pinned);
    const unpinned = convs.filter(c => !c.is_pinned);

    const now = new Date();
    const getLocalDateKey = (d) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const todayKey = getLocalDateKey(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = getLocalDateKey(yesterdayDate);
    const sevenDaysDate = new Date(now);
    sevenDaysDate.setDate(sevenDaysDate.getDate() - 7);
    const sevenDaysKey = getLocalDateKey(sevenDaysDate);

    const groups = {
      pinned: pinned,
      today: [],
      yesterday: [],
      previous7Days: [],
      older: [],
    };

    unpinned.forEach(conv => {
      const convDate = new Date(conv.updated_at || conv.created_at);
      const convLocalDateKey = getLocalDateKey(convDate);

      if (convLocalDateKey === todayKey) {
        groups.today.push(conv);
      } else if (convLocalDateKey === yesterdayKey) {
        groups.yesterday.push(conv);
      } else if (convLocalDateKey >= sevenDaysKey) {
        groups.previous7Days.push(conv);
      } else {
        groups.older.push(conv);
      }
    });

    return groups;
  };

  const groupedConversations = groupConversationsByDate(filteredConversations);

  // Shared conversation view
  if (window.location.pathname.startsWith('/shared/')) {
    if (sharedLoading) {
      return (
        <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading shared conversation...</p>
          </div>
        </div>
      );
    }
    if (sharedError) {
      return (
        <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="text-center max-w-md p-8">
            <div className="text-6xl mb-4">🔗</div>
            <h1 className="text-xl font-semibold mb-2">Unable to Load</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{sharedError}</p>
            <a href="/" className="px-4 py-2 bg-primary-500 text-white rounded-lg inline-block hover:bg-primary-600 transition-colors">
              Go to Homepage
            </a>
          </div>
        </div>
      );
    }
    if (sharedView) {
      return (
        <div className="h-screen flex flex-col bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h1 className="text-lg font-semibold truncate">{sharedView.conversation?.title || 'Shared Conversation'}</h1>
            <a href="/" className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm">
              Start New Chat
            </a>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {sharedView.messages?.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <div className="text-xs opacity-70 mb-1">{msg.role === 'user' ? 'You' : 'Assistant'}</div>
                    <div className="prose dark:prose-invert prose-sm max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500">
            This is a shared conversation. <a href="/" className="text-primary-500 hover:underline">Create your own</a>
          </div>
        </div>
      );
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className="h-screen flex bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-72' : 'w-0'} flex-shrink-0 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 overflow-hidden`}>
          <div className="p-4 flex flex-col h-full">
            {/* New Chat Button */}
            <button
              onClick={createConversation}
              className="flex items-center gap-2 w-full px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
            >
              <Icons.Plus />
              New Chat
            </button>

            {/* New Folder Button */}
            <button
              onClick={() => setShowFolderModal(true)}
              className="mt-2 flex items-center gap-2 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
            >
              <Icons.Folder />
              New Folder
            </button>

            {/* Search */}
            <div className="mt-4 relative">
              <Icons.Search />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Folders Section */}
            {folders.length > 0 && (
              <div className="mt-4 flex-1 overflow-y-auto space-y-1">
                {folders.map(folder => {
                  const folderConversations = conversations.filter(c =>
                    c.project_id === folder.id && !c.is_archived
                  );
                  const isExpanded = expandedFolders.includes(folder.id);
                  return (
                    <div key={folder.id} className="mb-2">
                      <div
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => toggleFolder(folder.id)}
                      >
                        <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          <Icons.ChevronRight />
                        </span>
                        <Icons.Folder />
                        <span className="text-sm font-medium flex-1">{folder.name}</span>
                        <span className="text-xs text-gray-500">{folderConversations.length}</span>
                      </div>
                      {isExpanded && folderConversations.length > 0 && (
                        <div className="ml-4 mt-1">
                          {folderConversations.map(conv => (
                            <ConversationItem
                              key={conv.id}
                              conversation={conv}
                              isActive={currentConversation?.id === conv.id}
                              onClick={() => selectConversation(conv)}
                              onDelete={deleteConversation}
                              onPin={pinConversation}
                              onArchive={archiveConversation}
                              onMoveToFolder={moveConversationToFolder}
                              folders={folders}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Conversations List */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-1">
              {groupedConversations.pinned.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">Pinned</p>
                  {groupedConversations.pinned.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={currentConversation?.id === conv.id}
                      onClick={() => selectConversation(conv)}
                      onDelete={deleteConversation}
                      onPin={pinConversation}
                      onArchive={archiveConversation}
                      onMoveToFolder={moveConversationToFolder}
                      onDuplicate={duplicateConversation}
                      onExport={exportConversation}
                      onShare={shareConversation}
                      folders={folders}
                    />
                  ))}
                </div>
              )}
              {showArchived && filteredConversations.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">Archived</p>
                  {filteredConversations.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={currentConversation?.id === conv.id}
                      onClick={() => selectConversation(conv)}
                      onDelete={deleteConversation}
                      onPin={pinConversation}
                      onArchive={archiveConversation}
                      onMoveToFolder={moveConversationToFolder}
                      onDuplicate={duplicateConversation}
                      onExport={exportConversation}
                      onShare={shareConversation}
                      folders={folders}
                    />
                  ))}
                </div>
              )}
              {!showArchived && groupedConversations.today.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">Today</p>
                  {groupedConversations.today.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={currentConversation?.id === conv.id}
                      onClick={() => selectConversation(conv)}
                      onDelete={deleteConversation}
                      onPin={pinConversation}
                      onArchive={archiveConversation}
                      onMoveToFolder={moveConversationToFolder}
                      onDuplicate={duplicateConversation}
                      onExport={exportConversation}
                      onShare={shareConversation}
                      folders={folders}
                    />
                  ))}
                </div>
              )}
              {!showArchived && groupedConversations.yesterday.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">Yesterday</p>
                  {groupedConversations.yesterday.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={currentConversation?.id === conv.id}
                      onClick={() => selectConversation(conv)}
                      onDelete={deleteConversation}
                      onPin={pinConversation}
                      onArchive={archiveConversation}
                      onMoveToFolder={moveConversationToFolder}
                      onDuplicate={duplicateConversation}
                      onExport={exportConversation}
                      onShare={shareConversation}
                      folders={folders}
                    />
                  ))}
                </div>
              )}
              {!showArchived && groupedConversations.previous7Days.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">Previous 7 Days</p>
                  {groupedConversations.previous7Days.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={currentConversation?.id === conv.id}
                      onClick={() => selectConversation(conv)}
                      onDelete={deleteConversation}
                      onPin={pinConversation}
                      onArchive={archiveConversation}
                      onMoveToFolder={moveConversationToFolder}
                      onDuplicate={duplicateConversation}
                      onExport={exportConversation}
                      onShare={shareConversation}
                      folders={folders}
                    />
                  ))}
                </div>
              )}
              {!showArchived && groupedConversations.older.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">Older</p>
                  {groupedConversations.older.map(conv => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      isActive={currentConversation?.id === conv.id}
                      onClick={() => selectConversation(conv)}
                      onDelete={deleteConversation}
                      onPin={pinConversation}
                      onArchive={archiveConversation}
                      onMoveToFolder={moveConversationToFolder}
                      onDuplicate={duplicateConversation}
                      onExport={exportConversation}
                      onShare={shareConversation}
                      folders={folders}
                    />
                  ))}
                </div>
              )}
              {filteredConversations.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 px-2">No conversations yet</p>
              )}
            </div>

            {/* Archived Conversations Toggle */}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`mt-2 flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors text-sm ${
                showArchived ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icons.Archived />
              {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="mt-4 flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              <Icons.Settings />
              Settings
            </button>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={e => setEditedTitle(e.target.value)}
                  onBlur={() => {
                    if (currentConversation && editedTitle.trim()) {
                      updateConversationTitle(currentConversation.id, editedTitle.trim());
                    }
                    setIsEditingTitle(false);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (currentConversation && editedTitle.trim()) {
                        updateConversationTitle(currentConversation.id, editedTitle.trim());
                      }
                      setIsEditingTitle(false);
                    } else if (e.key === 'Escape') {
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="text-lg font-semibold bg-transparent border-b-2 border-primary-500 focus:outline-none px-1"
                />
              ) : (
                <h1
                  className="text-lg font-semibold cursor-pointer hover:text-primary-500 transition-colors"
                  onDoubleClick={() => {
                    if (currentConversation) {
                      setEditedTitle(currentConversation.title || 'New Conversation');
                      setIsEditingTitle(true);
                    }
                  }}
                >
                  {currentConversation?.title || 'New Chat'}
                </h1>
              )}
            </div>
            <div className="flex items-center gap-3">
              <ModelSelector
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                  <Icons.Bot />
                </div>
                <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-md">
                  Ask me anything - I'm here to help with coding, writing, analysis, math, and more.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {['Help me write a function', 'Explain a concept', 'Debug my code', 'Brainstorm ideas'].map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map(message => (
                  <Message
                    key={message.id}
                    message={message}
                    onRegenerate={() => {}}
                    onEdit={startEditMessage}
                    isEditing={editingMessageId === message.id}
                    editedContent={editingMessageId === message.id ? editedMessageContent : ''}
                    onEditedContentChange={setEditedMessageContent}
                    onSaveEdit={saveEditedMessage}
                    onCancelEdit={cancelEditMessage}
                  />
                ))}
                {isStreaming && <TypingIndicator />}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 max-h-40"
                  style={{ minHeight: '48px' }}
                />
              </div>
              {isStreaming ? (
                <button
                  onClick={stopGeneration}
                  className="p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  <Icons.Stop />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="p-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                  <Icons.Send />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>

        {/* Folder Creation Modal */}
        {showFolderModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowFolderModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createFolder()}
                placeholder="Folder name"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowFolderModal(false);
                    setNewFolderName('');
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {showExportModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowExportModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Export Conversation</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    const conv = currentConversation || conversations[0];
                    if (conv) exportConversation(conv, 'json');
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${exportFormat === 'json' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  JSON
                </button>
                <button
                  onClick={() => {
                    const conv = currentConversation || conversations[0];
                    if (conv) exportConversation(conv, 'markdown');
                  }}
                  className={`px-4 py-2 rounded-lg transition-colors ${exportFormat === 'markdown' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  Markdown
                </button>
              </div>
              <div className="flex-1 overflow-auto mb-4">
                <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-auto max-h-96">
                  {exportData}
                </pre>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (exportData) {
                      const blob = new Blob([exportData], { type: exportFormat === 'markdown' ? 'text/markdown' : 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `conversation.${exportFormat === 'markdown' ? 'md' : 'json'}`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                >
                  Download {exportFormat === 'markdown' ? 'MD' : 'JSON'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowShareModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Share Conversation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Anyone with this link can view this conversation (read-only).
              </p>
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                  onClick={e => e.target.select()}
                />
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareLink);
                      alert('Link copied to clipboard!');
                    } catch (err) {
                      alert('Failed to copy link');
                    }
                  }}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
                >
                  Copy
                </button>
              </div>
              {shareData?.expires_at && (
                <p className="text-xs text-gray-500 mb-4">
                  Expires: {new Date(shareData.expires_at).toLocaleDateString()}
                </p>
              )}
              <div className="flex justify-between items-center">
                <button
                  onClick={revokeShare}
                  className="px-4 py-2 text-red-500 hover:text-red-600 transition-colors text-sm"
                >
                  Revoke Link
                </button>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">Delete Conversation</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Are you sure you want to delete this conversation? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteConversation}
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} temperature={temperature} setTemperature={setTemperature} topP={topP} setTopP={setTopP} />

        {/* Command Palette */}
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNewChat={createConversation}
          onOpenSettings={() => setShowSettings(true)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onSearch={setSearchQuery}
          conversations={conversations}
          onSelectConversation={(conv) => {
            selectConversation(conv);
            setShowCommandPalette(false);
          }}
        />
      </div>
    </ThemeContext.Provider>
  );
}

// Command Palette Component
function CommandPalette({ isOpen, onClose, onNewChat, onOpenSettings, onToggleSidebar, onSearch, conversations, onSelectConversation }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Available commands
  const allCommands = [
    { id: 'new-chat', name: 'New Chat', description: 'Start a new conversation', icon: 'plus', action: onNewChat, category: 'Actions' },
    { id: 'settings', name: 'Open Settings', description: 'Open application settings', icon: 'settings', action: onOpenSettings, category: 'Actions' },
    { id: 'toggle-sidebar', name: 'Toggle Sidebar', description: 'Show or hide the sidebar', icon: 'sidebar', action: onToggleSidebar, category: 'Actions' },
    { id: 'search-conversations', name: 'Search Conversations', description: 'Search through all conversations', icon: 'search', action: () => { onSearch(''); onClose(); }, category: 'Navigation' },
  ];

  // Add conversation commands
  const conversationCommands = conversations.slice(0, 10).map(conv => ({
    id: `conv-${conv.id}`,
    name: conv.title || 'Untitled Conversation',
    description: new Date(conv.updated_at).toLocaleDateString(),
    icon: 'chat',
    action: () => onSelectConversation(conv),
    category: 'Conversations',
    conversation: conv,
  }));

  // Filter commands based on query
  const filteredCommands = query.trim() === ''
    ? allCommands
    : [...allCommands, ...conversationCommands].filter(cmd =>
        cmd.name.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase())
      );

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
        e.preventDefault();
        filteredCommands[selectedIndex].action();
        onClose();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const renderIcon = (icon) => {
    switch (icon) {
      case 'plus':
        return <Icons.Plus />;
      case 'settings':
        return <Icons.Settings />;
      case 'search':
        return <Icons.Search />;
      case 'sidebar':
        return <Icons.Menu />;
      case 'chat':
        return <Icons.Chat />;
      default:
        return null;
    }
  };

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[15vh] z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 px-4">
          <Icons.Search />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full px-4 py-4 bg-transparent focus:outline-none text-base"
          />
          <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {Object.entries(groupedCommands).map(([category, commands]) => (
            <div key={category}>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900">
                {category}
              </div>
              {commands.map((cmd) => {
                const currentIndex = flatIndex++;
                const isSelected = currentIndex === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-primary-500/10 dark:bg-primary-500/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg ${
                      isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      {renderIcon(cmd.icon)}
                    </span>
                    <div className="flex-1">
                      <p className={`font-medium ${isSelected ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                        {cmd.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{cmd.description}</p>
                    </div>
                    {isSelected && (
                      <span className="text-xs text-gray-400">
                        <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded border border-gray-300 dark:border-gray-500">Enter</kbd>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
          {filteredCommands.length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No results found
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 flex gap-4">
          <span><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Enter</kbd> Select</span>
          <span><kbd className="px-1 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}

export default App;
