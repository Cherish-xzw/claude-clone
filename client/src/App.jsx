import React, { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import DOMPurify from 'dompurify';

// Theme Context
const ThemeContext = createContext();

function useTheme() {
  return useContext(ThemeContext);
}

// High Contrast Context
const HighContrastContext = createContext();

function useHighContrast() {
  return useContext(HighContrastContext);
}

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// API Base URL - use direct URL for API calls
const API_BASE = 'http://localhost:3001/api';

// Models configuration with pricing (per million tokens)
const MODELS = [
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Best balance of intelligence and speed', inputPricePerM: 3.75, outputPricePerM: 15 },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest responses, great for simple tasks', inputPricePerM: 0.80, outputPricePerM: 4 },
  { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', description: 'Most capable for complex tasks', inputPricePerM: 15, outputPricePerM: 75 },
];

// Calculate cost based on tokens and model
const calculateMessageCost = (inputTokens, outputTokens, modelId) => {
  const model = MODELS.find(m => m.id === modelId);
  if (!model) return 0;
  const inputCost = (inputTokens / 1000000) * model.inputPricePerM;
  const outputCost = (outputTokens / 1000000) * model.outputPricePerM;
  return inputCost + outputCost;
};

// Format cost for display
const formatCost = (cost) => {
  if (cost < 0.001) return '$0.00';
  if (cost < 0.01) return '$' + cost.toFixed(4);
  return '$' + cost.toFixed(4);
};

// Sound effects using Web Audio API
class SoundPlayer {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!this.enabled) return;

    try {
      const ctx = this.init();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;
      gainNode.gain.value = volume;
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      console.log('Sound playback error:', e);
    }
  }

  playSend() {
    // Short click sound for sending message
    this.playTone(800, 0.08, 'sine', 0.2);
    setTimeout(() => this.playTone(1000, 0.06, 'sine', 0.15), 50);
  }

  playReceive() {
    // Pleasant ding for receiving message
    this.playTone(523, 0.15, 'sine', 0.2);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.2), 100);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.15), 200);
  }

  playError() {
    // Low error tone
    this.playTone(200, 0.3, 'square', 0.15);
  }

  playSuccess() {
    // Ascending success tone
    this.playTone(440, 0.1, 'sine', 0.15);
    setTimeout(() => this.playTone(554, 0.1, 'sine', 0.15), 80);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.15), 160);
  }
}

const soundPlayer = new SoundPlayer();

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
  Eye: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  ),
  EyeOff: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
      <line x1="1" y1="1" x2="23" y2="23"></line>
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
  Merge: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="18" r="3"></circle>
      <circle cx="6" cy="6" r="3"></circle>
      <path d="M6 21V9a9 9 0 0 0 9 9"></path>
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
  Mic: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  ),
  MicOff: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"></line>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
      <line x1="12" y1="19" x2="12" y2="23"></line>
      <line x1="8" y1="23" x2="16" y2="23"></line>
    </svg>
  ),
  Bookmark: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  BookmarkFilled: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
    </svg>
  ),
  BookmarkPlus: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
      <line x1="12" y1="8" x2="12" y2="14"></line>
      <line x1="9" y1="11" x2="15" y2="11"></line>
    </svg>
  ),
  Mail: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
    </svg>
  ),
  MailOpen: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
      <polyline points="22,6 12,13 2,6"></polyline>
      <path d="M2 6l10 7 10-7"></path>
    </svg>
  ),
  CheckSquare: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"></polyline>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
    </svg>
  ),
  Print: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9"></polyline>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8"></rect>
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
function Message({ message, model, onRegenerate, onEdit, isEditing, editedContent, onEditedContentChange, onSaveEdit, onCancelEdit, onImageClick, onOpenArtifact, hasArtifact, onDelete, onBranch, showThinking = false, highContrast = false, language = 'en', hasThread = false, threadCount = 0, isThreadExpanded = false, onToggleThread = () => {}, isThreadReply = false, onMessageReferenceClick = null, highlightedMessageId = null }) {
  const isUser = message.role === 'user';
  const [thinkingExpanded, setThinkingExpanded] = React.useState(true);
  const [reactions, setReactions] = React.useState([]);
  const [showReactionPicker, setShowReactionPicker] = React.useState(false);

  // Check if language is RTL
  const isRTL = ['ar', 'he', 'fa', 'ur'].includes(language);

  // Calculate message cost
  const messageCost = calculateMessageCost(message.inputTokens || 0, message.outputTokens || 0, model);

  // Fetch reactions on mount
  React.useEffect(() => {
    const fetchReactions = async () => {
      try {
        const response = await fetch(`/api/messages/${message.id}/reactions`);
        if (response.ok) {
          const data = await response.json();
          setReactions(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed to fetch reactions:', error);
      }
    };
    if (message.id) {
      fetchReactions();
    }
  }, [message.id]);

  // Handle adding/removing reaction
  const handleReaction = async (emoji) => {
    try {
      const response = await fetch(`/api/messages/${message.id}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, user_id: 'default' })
      });
      if (response.ok) {
        const result = await response.json();
        // Refetch reactions to update UI
        const reactionsResponse = await fetch(`/api/messages/${message.id}/reactions`);
        if (reactionsResponse.ok) {
          const data = await reactionsResponse.json();
          setReactions(Array.isArray(data) ? data : []);
        }
        setShowReactionPicker(false);
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  // Common reaction emojis
  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const isHighlighted = highlightedMessageId === message.id;

  return (
    <article id={`message-${message.id}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in ${isHighlighted ? 'ring-4 ring-yellow-400 ring-opacity-75 rounded-lg transition-all duration-300' : ''}`} role="article" aria-label={`${isUser ? 'Your' : 'Assistant'} message`}>
      <div className={`flex gap-3 max-w-3xl ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-primary-500 text-white' : highContrast ? 'bg-gray-300 border-2 border-black' : 'bg-gray-200 dark:bg-gray-700'
        }`} role="img" aria-label={isUser ? 'You' : 'Assistant'}>
          {isUser ? <Icons.User /> : <Icons.Bot />}
        </div>
        <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Display thinking content if present and enabled */}
          {showThinking && message.thinking && (
            <div className="mb-2 w-full">
              <button
                onClick={() => setThinkingExpanded(!thinkingExpanded)}
                className={`flex items-center gap-2 text-xs mb-1 ${highContrast ? 'text-black' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                aria-expanded={thinkingExpanded}
                aria-controls="thinking-content"
              >
                <span className={`transform transition-transform ${thinkingExpanded ? 'rotate-90' : ''}`} aria-hidden="true">▶</span>
                <span>Thinking ({(message.thinking || '').length} chars)</span>
              </button>
              {thinkingExpanded && (
                <div id="thinking-content" className={`rounded-lg p-3 text-xs max-h-64 overflow-y-auto font-mono whitespace-pre-wrap ${highContrast ? 'bg-gray-200 border-2 border-black text-black' : 'bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}`} role="region" aria-label="Thinking content">
                  {message.thinking}
                </div>
              )}
            </div>
          )}
          {/* Display images if present */}
          {Array.isArray(message.images) && message.images.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`} role="list" aria-label="Attached images">
              {message.images.map((image, index) => (
                <div
                  key={image.id || index}
                  className="relative group cursor-pointer"
                  onClick={() => onImageClick && onImageClick(image.data)}
                  role="listitem"
                >
                  <img
                    src={image.data}
                    alt={image.name || 'Uploaded image'}
                    className={`max-w-[200px] max-h-[200px] rounded-lg border border-gray-300 dark:border-gray-600 object-cover ${
                      isUser ? '' : ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                    <Icons.Maximize2 className="opacity-0 group-hover:opacity-100 text-white transition-opacity" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={`px-4 py-3 rounded-2xl border-2 ${
            isUser
              ? 'bg-primary-500 text-white rounded-tr-sm border-primary-600'
              : highContrast
                ? 'bg-gray-100 rounded-tl-sm border-2 border-black'
                : 'bg-gray-100 dark:bg-gray-800 rounded-tl-sm'
          }`} dir={isUser && isRTL ? 'rtl' : 'ltr'}>
            {isEditing ? (
              <div className="w-full">
                <textarea
                  value={editedContent}
                  onChange={(e) => onEditedContentChange(e.target.value)}
                  className={`w-full min-h-[100px] rounded p-2 text-sm ${highContrast ? 'bg-white border-2 border-black text-black' : 'bg-transparent border border-gray-300 dark:border-gray-600 text-black dark:text-white'}`}
                  autoFocus
                  dir={isRTL ? 'rtl' : 'ltr'}
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
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeHighlight, rehypeRaw, rehypeKatex]}
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
                      },
                      a({ node, href, children, ...props }) {
                        // Validate and sanitize URL - only allow safe protocols
                        const safeHref = href && /^https?:\/\//i.test(href) ? href : '#';
                        return (
                          <a href={safeHref} target="_blank" rel="noopener noreferrer" {...props}>
                            {children}
                          </a>
                        );
                      },
                      div({ node, children, ...props }) {
                        // Sanitize div content to prevent XSS
                        if (node.properties?.dangerouslySetInnerHTML) {
                          const html = node.properties.dangerouslySetInnerHTML.__html || '';
                          const sanitized = DOMPurify.sanitize(html, {
                            ALLOWED_TAGS: ['div', 'span', 'p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img', 'input', 'button'],
                            ALLOWED_ATTR: ['class', 'id', 'href', 'target', 'rel', 'src', 'alt', 'title', 'type', 'value', 'checked', 'disabled', 'className'],
                            ALLOW_DATA_ATTR: false,
                            ADD_ATTR: ['target', 'rel']
                          });
                          return <div {...props} dangerouslySetInnerHTML={{ __html: sanitized }}>{children}</div>;
                        }
                        return <div {...props}>{children}</div>;
                      },
                      span({ node, children, ...props }) {
                        // Sanitize span content to prevent XSS
                        if (node.properties?.dangerouslySetInnerHTML) {
                          const html = node.properties.dangerouslySetInnerHTML.__html || '';
                          const sanitized = DOMPurify.sanitize(html, {
                            ALLOWED_TAGS: ['span', 'a', 'code', 'strong', 'em', 'del', 'ins', 'sub', 'sup'],
                            ALLOWED_ATTR: ['class', 'id', 'href', 'target', 'rel', 'className'],
                            ALLOW_DATA_ATTR: false
                          });
                          return <span {...props} dangerouslySetInnerHTML={{ __html: sanitized }}>{children}</span>;
                        }
                        return <span {...props}>{children}</span>;
                      },
                      p({ node, children, ...props }) {
                        // Process children to detect message references like @[msg:123]
                        const processChildren = (nodes) => {
                          return React.Children.map(nodes, child => {
                            if (typeof child === 'string') {
                              // Split string by message reference pattern @[msg:xxx] or msg-xxx
                              const parts = child.split(/(@\[[\w-]+\]|\bmsg-[\w-]+\b)/g);
                              return parts.map((part, idx) => {
                                // Check for message reference patterns
                                const msgRefMatch = part.match(/@\[(msg:[\w-]+)\]|msg-([\w-]+)/);
                                if (msgRefMatch) {
                                  const refId = msgRefMatch[1] || msgRefMatch[2];
                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => onMessageReferenceClick && onMessageReferenceClick(refId)}
                                      className="text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 underline cursor-pointer bg-transparent border-none p-0 m-0 text-inherit font-inherit"
                                      title={`Jump to message ${refId}`}
                                    >
                                      {part}
                                    </button>
                                  );
                                }
                                return part;
                              });
                            }
                            return child;
                          });
                        };

                        // Sanitize paragraph content to prevent XSS
                        if (node.properties?.dangerouslySetInnerHTML) {
                          const html = node.properties.dangerouslySetInnerHTML.__html || '';
                          const sanitized = DOMPurify.sanitize(html, {
                            ALLOWED_TAGS: ['span', 'a', 'code', 'strong', 'em', 'del', 'ins', 'sub', 'sup', 'br'],
                            ALLOWED_ATTR: ['class', 'id', 'href', 'target', 'rel', 'className'],
                            ALLOW_DATA_ATTR: false
                          });
                          return <p {...props} dangerouslySetInnerHTML={{ __html: sanitized }}>{processChildren(children)}</p>;
                        }
                        return <p {...props}>{processChildren(children)}</p>;
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
          {/* Token usage display - show for messages with token info */}
          {(message.inputTokens > 0 || message.outputTokens > 0 || message.responseTime) && (
            <div className="mt-1 text-xs text-gray-400 dark:text-gray-500 flex gap-2 flex-wrap">
              {message.responseTime && (
                <span title="Response time">{message.responseTime}s</span>
              )}
              {message.inputTokens > 0 && (
                <span title="Input tokens">↑ {message.inputTokens}</span>
              )}
              {message.outputTokens > 0 && (
                <span title="Output tokens">↓ {message.outputTokens}</span>
              )}
              {(message.inputTokens > 0 || message.outputTokens > 0) && (
                <span>tokens</span>
              )}
              {messageCost > 0 && (
                <span className="text-primary-500/70 dark:text-primary-400/70" title="Estimated cost">
                  · {formatCost(messageCost)}
                </span>
              )}
            </div>
          )}
          {!isUser && !message.isStreaming && !isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(message.content);
                }}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <Icons.Copy /> Copy
              </button>
              <button
                onClick={() => onRegenerate && onRegenerate(message.id)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Regenerate
              </button>
              {hasArtifact && (
                <button
                  onClick={() => onOpenArtifact && onOpenArtifact()}
                  className="text-xs text-primary-500 hover:text-primary-600 dark:text-primary-400 dark:hover:text-primary-300 px-2 py-1 rounded hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                >
                  Open Artifact
                </button>
              )}
            </div>
          )}
          {isUser && !isEditing && (
            <div className="flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(message.content)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
              >
                <Icons.Copy /> Copy
              </button>
              <button
                onClick={() => onEdit && onEdit(message)}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => onBranch && onBranch(message)}
                className="text-xs text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Branch
              </button>
              <button
                onClick={() => onDelete && onDelete(message)}
                className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
          {/* Thread toggle button for messages with threads */}
          {hasThread && !isEditing && (
            <div className="mt-2">
              <button
                onClick={onToggleThread}
                className={`text-xs px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                  isThreadExpanded
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30'
                    : 'text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isThreadExpanded ? 'rotate-90' : ''}>
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                {isThreadExpanded ? 'Hide' : 'Show'} {threadCount} {threadCount === 1 ? 'reply' : 'replies'}
              </button>
            </div>
          )}
          {/* Reactions display and picker */}
          <div className="relative mt-1">
            {/* Existing reactions */}
            {reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                    title={`${reaction.count} reaction${reaction.count > 1 ? 's' : ''}`}
                  >
                    <span>{reaction.emoji}</span>
                    <span className="text-gray-600 dark:text-gray-300">{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Add reaction button */}
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors mt-1"
              aria-label="Add reaction"
            >
              <span>Add reaction</span>
            </button>
            {/* Reaction picker popup */}
            {showReactionPicker && (
              <div className="absolute z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2 flex gap-1">
                {reactionEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
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

// Get language-specific labels
const getLanguageLabels = (lang) => {
  const labels = {
    en: { today: 'Today', yesterday: 'Yesterday', daysAgo: 'days ago' },
    zh: { today: '今天', yesterday: '昨天', daysAgo: '天前' },
    es: { today: 'Hoy', yesterday: 'Ayer', daysAgo: 'días atrás' },
    fr: { today: "Aujourd'hui", yesterday: 'Hier', daysAgo: "jours d'accord" },
    de: { today: 'Heute', yesterday: 'Gestern', daysAgo: 'Tagen' },
    ja: { today: '今日', yesterday: '昨日', daysAgo: '日前' },
    ko: { today: '오늘', yesterday: '어제', daysAgo: '일 전' },
    pt: { today: 'Hoje', yesterday: 'Ontem', daysAgo: 'dias atrás' },
    ru: { today: 'Сегодня', yesterday: 'Вчера', daysAgo: 'дней назад' },
    ar: { today: 'اليوم', yesterday: 'أمس', daysAgo: 'أيام مضت' },
  };
  return labels[lang] || labels.en;
};

// Helper to get saved language
const getSavedLanguage = () => {
  const saved = localStorage.getItem('app_language');
  return saved ? JSON.parse(saved) : 'en';
};

// Check if language is RTL (right-to-left)
const isRTL = (lang) => {
  const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
  return rtlLanguages.includes(lang);
};

// Format date helper - module level for use in both ConversationItem and App
const formatDateHelper = (dateStr, currentLang = 'en') => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  const labels = {
    en: { today: 'Today', yesterday: 'Yesterday', daysAgo: 'days ago' },
    zh: { today: '今天', yesterday: '昨天', daysAgo: '天前' },
    es: { today: 'Hoy', yesterday: 'Ayer', daysAgo: 'días atrás' },
    fr: { today: "Aujourd'hui", yesterday: 'Hier', daysAgo: "jours atrás" },
    de: { today: 'Heute', yesterday: 'Gestern', daysAgo: 'Tagen' },
    ja: { today: '今日', yesterday: '昨日', daysAgo: '日前' },
    ko: { today: '오늘', yesterday: '어제', daysAgo: '일 전' },
    pt: { today: 'Hoje', yesterday: 'Ontem', daysAgo: 'dias atrás' },
    ru: { today: 'Сегодня', yesterday: 'Вчера', daysAgo: 'дней назад' },
    ar: { today: 'اليوم', yesterday: 'أمس', daysAgo: 'أيام' },
  };
  const langLabels = labels[currentLang] || labels.en;

  if (days === 0) return langLabels.today;
  if (days === 1) return langLabels.yesterday;
  if (days < 7) return `${days} ${langLabels.daysAgo}`;
  // Format date based on language
  const localeMap = {
    en: 'en-US', zh: 'zh-CN', es: 'es-ES', fr: 'fr-FR',
    de: 'de-DE', ja: 'ja-JP', ko: 'ko-KR', pt: 'pt-BR',
    ru: 'ru-RU', ar: 'ar-SA'
  };
  return date.toLocaleDateString(localeMap[currentLang] || 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

// Conversation preview popup component - shows message content on hover
function ConversationPreviewPopup({ conversationId, title, position, messages, isLoading, onClose }) {
  if (!conversationId || !position) return null;

  // Get up to 5 messages for preview
  const previewMessages = messages.slice(0, 5);

  // Calculate popup position - show to the right of the sidebar
  const left = position.right + 10;
  const top = Math.max(10, position.top - 50);

  // Truncate message content for preview
  const truncateText = (text, maxLength = 150) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-80 max-h-96 overflow-hidden animate-fade-in"
      style={{ left: `${left}px`, top: `${top}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <p className="text-sm font-medium truncate flex-1">{title || 'Conversation Preview'}</p>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500"
          aria-label="Close preview"
        >
          <Icons.X />
        </button>
      </div>
      <div className="p-2 space-y-2 max-h-72 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div>
          </div>
        ) : previewMessages.length > 0 ? (
          previewMessages.map((msg, index) => (
            <div key={msg.id || index} className="text-xs">
              <div className="flex items-start gap-2">
                <span className={`font-medium shrink-0 ${msg.role === 'user' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                  {msg.role === 'user' ? 'You:' : 'Claude:'}
                </span>
                <p className="text-gray-700 dark:text-gray-300 line-clamp-3 whitespace-pre-wrap">
                  {truncateText(typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No messages in this conversation</p>
        )}
      </div>
    </div>
  );
}

// Conversation item in sidebar
function ConversationItem({ conversation, isActive, onClick, onDelete, onPin, onArchive, onMoveToFolder, onDuplicate, onExport, onPrint, onShare, onToggleUnread, onToggleFavorite, onMerge, folders, language, bulkSelectMode, isSelected, onToggleSelect, onHover, onLeave }) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [itemRef, setItemRef] = useState(null);
  // Use language prop if provided, otherwise fallback to localStorage
  const currentLang = language || getSavedLanguage();

  const formatDate = (dateStr) => formatDateHelper(dateStr, currentLang);

  const handleMouseEnter = () => {
    if (itemRef && onHover) {
      const rect = itemRef.getBoundingClientRect();
      onHover(conversation.id, conversation.title || 'New Conversation', rect);
    }
  };

  const handleMouseLeave = () => {
    if (onLeave) {
      onLeave();
    }
  };

  return (
    <div className="relative" role="listitem">
      {bulkSelectMode && (
        <input
          type="checkbox"
          checked={isSelected || false}
          onChange={() => onToggleSelect(conversation.id)}
          className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500 cursor-pointer"
          aria-label={`Select ${conversation.title || 'conversation'}`}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div
        ref={setItemRef}
        onClick={() => {
          if (bulkSelectMode) {
            onToggleSelect(conversation.id);
          } else {
            onClick();
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (bulkSelectMode) {
              onToggleSelect(conversation.id);
            } else {
              onClick();
            }
          }
        }}
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
          isActive
            ? 'bg-gray-200 dark:bg-gray-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        } ${bulkSelectMode ? 'flex-1' : ''}`}
        aria-current={isActive ? 'page' : undefined}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate flex items-center gap-1">
            {conversation.is_pinned ? (
              <span className="text-primary-500" aria-hidden="true"><Icons.Pinned /></span>
            ) : null}
            {conversation.is_favorited ? (
              <span className="text-yellow-500" aria-hidden="true"><Icons.BookmarkFilled /></span>
            ) : null}
            {conversation.title || 'New Conversation'}
            {conversation.is_unread ? (
              <span className="inline-flex items-center justify-center w-2 h-2 bg-primary-500 rounded-full" title="Unread" aria-label="Unread"></span>
            ) : null}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDate(conversation.updated_at)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleUnread(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title={conversation.is_unread ? 'Mark as read' : 'Mark as unread'}
          aria-label={conversation.is_unread ? 'Mark as read' : 'Mark as unread'}
        >
          {conversation.is_unread ? <Icons.MailOpen /> : <Icons.Mail />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPin(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title={conversation.is_pinned ? 'Unpin' : 'Pin'}
          aria-label={conversation.is_pinned ? 'Unpin conversation' : 'Pin conversation'}
        >
          {conversation.is_pinned ? <Icons.Pinned /> : <Icons.Pin />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title={conversation.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={conversation.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {conversation.is_favorited ? <Icons.BookmarkFilled /> : <Icons.BookmarkPlus />}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onArchive(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title={conversation.is_archived ? 'Unarchive' : 'Archive'}
          aria-label={conversation.is_archived ? 'Unarchive conversation' : 'Archive conversation'}
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
          aria-label="Duplicate conversation"
        >
          <Icons.Copy />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMerge(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Merge"
          aria-label="Merge conversation"
        >
          <Icons.Merge />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Share"
          aria-label="Share conversation"
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
          aria-label="Export conversation"
        >
          <Icons.Download />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrint(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Print"
          aria-label="Print conversation"
        >
          <Icons.Print />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMoveMenu(!showMoveMenu);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          title="Move to folder"
          aria-label="Move to folder"
        >
          <Icons.Folder />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(conversation);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
          aria-label="Delete conversation"
          title="Delete"
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

// Model selector dropdown - keyboard accessible
function ModelSelector({ selectedModel, onModelChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const buttonRef = useRef(null);

  const selectedModelInfo = MODELS.find(m => m.id === selectedModel) || MODELS[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      // Open dropdown with Enter or Space
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setFocusedIndex(MODELS.findIndex(m => m.id === selectedModel));
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => (prev < MODELS.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => (prev > 0 ? prev - 1 : MODELS.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < MODELS.length) {
          onModelChange(MODELS[focusedIndex].id);
          setIsOpen(false);
          setFocusedIndex(-1);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Model selector, currently ${selectedModelInfo.name}`}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <span>{selectedModelInfo.name}</span>
        <Icons.ChevronDown />
      </button>
      {isOpen && (
        <div
          role="listbox"
          aria-label="Select model"
          className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50"
        >
          {MODELS.map((model, index) => (
            <button
              key={model.id}
              role="option"
              aria-selected={model.id === selectedModel}
              onClick={() => {
                onModelChange(model.id);
                setIsOpen(false);
                setFocusedIndex(-1);
              }}
              onMouseEnter={() => setFocusedIndex(index)}
              className={`w-full text-left px-4 py-2 transition-colors focus:outline-none ${
                model.id === selectedModel ? 'bg-gray-50 dark:bg-gray-750' : ''
              } ${focusedIndex === index ? 'bg-gray-100 dark:bg-gray-700' : ''} ${
                focusedIndex === index ? 'ring-1 ring-inset ring-primary-500' : ''
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

// Keyboard Shortcuts Modal
function KeyboardShortcutsModal({ isOpen, onClose }) {
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

  const shortcuts = [
    { category: 'General', items: [
      { keys: ['Cmd', 'K'], description: 'Open command palette' },
      { keys: ['Cmd', 'N'], description: 'New conversation' },
      { keys: ['Cmd', 'S'], description: 'Save conversation' },
      { keys: ['Cmd', '/'], description: 'Open keyboard shortcuts' },
      { keys: ['Cmd', 'Shift', 'L'], description: 'Toggle dark mode' },
      { keys: ['Cmd', 'Shift', 'F'], description: 'Toggle focus mode' },
      { keys: ['Cmd', 'Shift', 'Q'], description: 'Logout' },
      { keys: ['Esc'], description: 'Close modal/palette' },
    ]},
    { category: 'Messages', items: [
      { keys: ['Enter'], description: 'Send message' },
      { keys: ['Shift', 'Enter'], description: 'New line in message' },
      { keys: ['Cmd', 'Enter'], description: 'Send message (alternative)' },
    ]},
    { category: 'Navigation', items: [
      { keys: ['Cmd', '['], description: 'Previous conversation' },
      { keys: ['Cmd', ']'], description: 'Next conversation' },
      { keys: ['Cmd', 'B'], description: 'Toggle sidebar' },
    ]},
    { category: 'Editing', items: [
      { keys: ['Cmd', 'Z'], description: 'Undo' },
      { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Cmd', 'A'], description: 'Select all' },
    ]},
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-lg">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-60px)]">
          {shortcuts.map((section, idx) => (
            <div key={idx} className="mb-6 last:mb-0">
              <h4 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase mb-3">{section.category}</h4>
              <div className="space-y-2">
                {section.items.map((shortcut, sIdx) => (
                  <div key={sIdx} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, kIdx) => (
                        <span key={kIdx}>
                          <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono">
                            {key}
                          </kbd>
                          {kIdx < shortcut.keys.length - 1 && <span className="text-gray-400 mx-0.5">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Usage Dashboard Component - displays API usage statistics
function UsageDashboard({ usageLimits, setUsageLimits, showToast }) {
  const [dailyUsage, setDailyUsage] = useState([]);
  const [monthlyData, setMonthlyData] = useState(null);
  const [modelUsage, setModelUsage] = useState([]);
  const [todayUsage, setTodayUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState('json');

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    setLoading(true);
    try {
      const [dailyRes, monthlyRes, modelRes, todayRes] = await Promise.all([
        fetch(`${API_BASE}/usage/daily`),
        fetch(`${API_BASE}/usage/monthly`),
        fetch(`${API_BASE}/usage/by-model`),
        fetch(`${API_BASE}/usage/today`)
      ]);

      const daily = await dailyRes.json();
      const monthly = await monthlyRes.json();
      const models = await modelRes.json();
      const today = await todayRes.json();

      setDailyUsage(Array.isArray(daily) ? daily : []);
      setMonthlyData(monthly);
      setModelUsage(Array.isArray(models) ? models : []);
      setTodayUsage(today);
    } catch (error) {
      console.error('Error fetching usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check usage limits and show warnings
  useEffect(() => {
    if (!usageLimits?.enabled || !monthlyData?.totals || !todayUsage) return;

    const monthlyTokens = monthlyData.totals.input_tokens + (monthlyData.totals.output_tokens || 0);
    const dailyCost = todayUsage?.cost || 0;
    const tokenLimit = usageLimits?.monthlyTokenLimit || 1000000;
    const costLimit = usageLimits?.dailyCostLimit || 10;
    const threshold = (usageLimits?.warningThreshold || 80) / 100;

    // Check if approaching or exceeding limits
    if (monthlyTokens > tokenLimit) {
      showToast('Monthly token limit exceeded! Consider reducing usage.', 'error');
    } else if (monthlyTokens > tokenLimit * threshold) {
      showToast(`Warning: You've used ${Math.round((monthlyTokens / tokenLimit) * 100)}% of your monthly token limit.`, 'warning');
    }

    if (dailyCost > costLimit) {
      showToast(`Daily cost limit exceeded! You've spent $${dailyCost.toFixed(2)} today.`, 'error');
    } else if (dailyCost > costLimit * threshold) {
      showToast(`Warning: You've spent $${dailyCost.toFixed(2)} of your $${costLimit.toFixed(2)} daily limit.`, 'warning');
    }
  }, [monthlyData, todayUsage, usageLimits]);

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCost = (cost) => {
    if (!cost) return '$0.00';
    return '$' + cost.toFixed(4);
  };

  const formatMonth = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  // Export usage data
  const exportUsageData = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      today: todayUsage || {},
      monthly: monthlyData || {},
      byModel: modelUsage || [],
      daily: dailyUsage || []
    };

    let content, filename, mimeType;

    if (exportFormat === 'csv') {
      // Convert to CSV format
      const headers = ['Category', 'Metric', 'Value'];
      const rows = [
        ['Today', 'Input Tokens', todayUsage?.input_tokens || 0],
        ['Today', 'Output Tokens', todayUsage?.output_tokens || 0],
        ['Today', 'Messages', todayUsage?.message_count || 0],
        ['Today', 'Cost', todayUsage?.cost || 0],
        ['Monthly', 'Input Tokens', monthlyData?.totals?.input_tokens || 0],
        ['Monthly', 'Output Tokens', monthlyData?.totals?.output_tokens || 0],
        ['Monthly', 'Messages', monthlyData?.totals?.message_count || 0],
        ['Monthly', 'Total Cost', monthlyData?.totals?.cost || 0],
        ...modelUsage.map(m => ['Model', m.model, `${m.input_tokens}/${m.output_tokens}`]),
        ...dailyUsage.map(d => ['Daily', d.date, d.message_count || 0])
      ];
      content = [headers, ...rows].map(row => row.join(',')).join('\n');
      filename = `usage-export-${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(exportData, null, 2);
      filename = `usage-export-${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Usage data exported as ${exportFormat.toUpperCase()}`, 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-lg">Usage Statistics</h4>
        <div className="flex items-center gap-2">
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <button
            onClick={exportUsageData}
            className="px-3 py-1.5 text-sm bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export
          </button>
        </div>
      </div>

      {/* Today's Summary */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-4 text-white">
        <h5 className="text-sm font-medium opacity-90 mb-3">Today's Usage</h5>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{formatNumber(todayUsage?.input_tokens)}</p>
            <p className="text-xs opacity-80">Input Tokens</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatNumber(todayUsage?.output_tokens)}</p>
            <p className="text-xs opacity-80">Output Tokens</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{todayUsage?.message_count || 0}</p>
            <p className="text-xs opacity-80">Messages</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{formatCost(todayUsage?.cost)}</p>
            <p className="text-xs opacity-80">Est. Cost</p>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      {monthlyData && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h5 className="font-medium mb-3">All-Time Summary</h5>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xl font-semibold">{formatNumber(monthlyData.totals?.input_tokens)}</p>
              <p className="text-xs text-gray-500">Input Tokens</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{formatNumber(monthlyData.totals?.output_tokens)}</p>
              <p className="text-xs text-gray-500">Output Tokens</p>
            </div>
            <div>
              <p className="text-xl font-semibold">{monthlyData.totals?.message_count || 0}</p>
              <p className="text-xs text-gray-500">Messages</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-primary-600">{formatCost(monthlyData.totals?.cost)}</p>
              <p className="text-xs text-gray-500">Total Cost</p>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Breakdown */}
      {monthlyData && monthlyData.monthly && monthlyData.monthly.length > 0 && (
        <div>
          <h5 className="font-medium mb-3">Monthly Breakdown</h5>
          <div className="space-y-2">
            {monthlyData.monthly.map((month, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{formatMonth(month.month)}</p>
                  <p className="text-xs text-gray-500">
                    {formatNumber(month.input_tokens)} in / {formatNumber(month.output_tokens)} out
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-sm">{month.message_count} msgs</p>
                  <p className="text-xs text-primary-600">{formatCost(month.cost)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Model Usage */}
      {modelUsage.length > 0 && (
        <div>
          <h5 className="font-medium mb-3">Usage by Model</h5>
          <div className="space-y-2">
            {modelUsage.map((model, idx) => {
              const modelName = MODELS.find(m => m.id === model.model)?.name || model.model;
              return (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{modelName}</p>
                    <p className="text-xs text-gray-500">
                      {formatNumber(model.input_tokens)} in / {formatNumber(model.output_tokens)} out
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{model.message_count} msgs</p>
                    <p className="text-xs text-primary-600">{formatCost(model.cost)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily Chart */}
      {dailyUsage.length > 0 && (
        <div>
          <h5 className="font-medium mb-3">Last 7 Days</h5>
          <div className="flex items-end gap-1 h-24">
            {dailyUsage.slice(0, 7).reverse().map((day, idx) => {
              const maxMessages = Math.max(...dailyUsage.map(d => d.message_count || 0), 1);
              const height = Math.max(10, ((day.message_count || 0) / maxMessages) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-primary-500 rounded-t transition-all"
                    style={{ height: `${height}%` }}
                    title={`${day.message_count || 0} messages`}
                  ></div>
                  <p className="text-xs text-gray-500">
                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* API Quota Information */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h5 className="font-medium mb-3 text-blue-900 dark:text-blue-100">API Quota</h5>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Monthly Input</p>
            <p className="text-lg font-semibold">{formatNumber(monthlyData?.totals?.input_tokens || 0)}</p>
            <p className="text-xs text-gray-400">/ 10M tokens</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Monthly Output</p>
            <p className="text-lg font-semibold">{formatNumber(monthlyData?.totals?.output_tokens || 0)}</p>
            <p className="text-xs text-gray-400">/ 50M tokens</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
          <p className="text-xs text-gray-500">
            <span className="font-medium">Quota resets:</span> First of next month
          </p>
          {React.createElement(() => {
            const [timeUntilReset, setTimeUntilReset] = React.useState('');
            React.useEffect(() => {
              const updateCountdown = () => {
                const now = new Date();
                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                const diff = nextMonth - now;
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setTimeUntilReset(`${days}d ${hours}h ${minutes}m`);
              };
              updateCountdown();
              const interval = setInterval(updateCountdown, 60000);
              return () => clearInterval(interval);
            }, []);
            return timeUntilReset ? (
              <p className="text-xs text-primary-500 mt-1">Resets in: {timeUntilReset}</p>
            ) : null;
          })}
        </div>
      </div>

      {/* Usage Limits Configuration */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between mb-4">
          <h5 className="font-medium text-purple-900 dark:text-purple-100">Usage Limits</h5>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={usageLimits?.enabled || false}
              onChange={(e) => {
                const newLimits = { ...usageLimits, enabled: e.target.checked };
                setUsageLimits(newLimits);
                if (e.target.checked) {
                  showToast('Usage limits enabled', 'success');
                }
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-500"></div>
          </label>
        </div>

        {usageLimits?.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Monthly Token Limit: {formatNumber(usageLimits?.monthlyTokenLimit || 1000000)}
              </label>
              <input
                type="range"
                min="100000"
                max="10000000"
                step="100000"
                value={usageLimits?.monthlyTokenLimit || 1000000}
                onChange={(e) => {
                  const newLimits = { ...usageLimits, monthlyTokenLimit: parseInt(e.target.value) };
                  setUsageLimits(newLimits);
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Warning when usage exceeds this limit</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Daily Cost Limit: ${(usageLimits?.dailyCostLimit || 10).toFixed(2)}
              </label>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={usageLimits?.dailyCostLimit || 10}
                onChange={(e) => {
                  const newLimits = { ...usageLimits, dailyCostLimit: parseFloat(e.target.value) };
                  setUsageLimits(newLimits);
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum daily cost in USD</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Warning Threshold: {usageLimits?.warningThreshold || 80}%
              </label>
              <input
                type="range"
                min="50"
                max="100"
                step="5"
                value={usageLimits?.warningThreshold || 80}
                onChange={(e) => {
                  const newLimits = { ...usageLimits, warningThreshold: parseInt(e.target.value) };
                  setUsageLimits(newLimits);
                }}
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-1">Show warning when reaching this percentage of limits</p>
            </div>

            {/* Current Status */}
            {monthlyData && monthlyData.totals && (
              <div className="mt-4 p-3 bg-white/50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Current Status</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                    <div
                      className={`h-2 rounded-full ${
                        (monthlyData.totals.input_tokens / (usageLimits?.monthlyTokenLimit || 1000000)) > 1 ? 'bg-red-500' :
                        (monthlyData.totals.input_tokens / (usageLimits?.monthlyTokenLimit || 1000000)) > ((usageLimits?.warningThreshold || 80) / 100) ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (monthlyData.totals.input_tokens / (usageLimits?.monthlyTokenLimit || 1000000)) * 100)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {Math.round((monthlyData.totals.input_tokens / (usageLimits?.monthlyTokenLimit || 1000000)) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {dailyUsage.length === 0 && monthlyData?.monthly?.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No usage data yet. Start a conversation to see your stats!</p>
        </div>
      )}
    </div>
  );
}

// Settings modal
function SettingsModal({ isOpen, onClose, temperature, setTemperature, topP, setTopP, maxTokens, setMaxTokens, thinkingEnabled, setThinkingEnabled, onOpenKeyboardShortcuts, highContrast, setHighContrast, reducedMotion, setReducedMotion, systemPrompt, onSystemPromptChange, language, setLanguage, usageLimits, setUsageLimits, soundEffectsEnabled, setSoundEffectsEnabled, notificationSettings, setNotificationSettings, customInstructionTemplates, openCustomInstructionModal, selectInstructionTemplate, selectedInstructionTemplate, globalCustomInstructions, setGlobalCustomInstructions, onExportAllData, showInstructionsPreview, setShowInstructionsPreview, previewTestPrompt, setPreviewTestPrompt, previewResponse, previewLoading, testInstructionsPreview, activeSessions, sessionsLoading, fetchActiveSessions, logoutSession, logoutOtherSessions }) {
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
    { id: 'accessibility', label: 'Accessibility' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'usage', label: 'Usage' },
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
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <h5 className="font-medium text-sm">Sound Effects</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Play sounds for message sent/received</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={soundEffectsEnabled}
                      onChange={(e) => {
                        setSoundEffectsEnabled(e.target.checked);
                        soundPlayer.setEnabled(e.target.checked);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                  </label>
                </div>
                {/* Notification Settings */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h5 className="font-medium text-sm mb-3">Notification Preferences</h5>
                  <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm">New message notifications</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when new messages arrive</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.newMessageNotifications}
                          onChange={(e) => setNotificationSettings(prev => ({ ...prev, newMessageNotifications: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm">Conversation activity</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Notify about conversation updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.conversationActivity}
                          onChange={(e) => setNotificationSettings(prev => ({ ...prev, conversationActivity: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm">Mention notifications</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Get notified when mentioned in comments</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.mentionNotifications}
                          onChange={(e) => setNotificationSettings(prev => ({ ...prev, mentionNotifications: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm">Desktop notifications</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Show browser desktop notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.desktopNotifications}
                          onChange={(e) => {
                            setNotificationSettings(prev => ({ ...prev, desktopNotifications: e.target.checked }));
                            if (e.target.checked && 'Notification' in window && Notification.permission === 'default') {
                              Notification.requestPermission();
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                    {/* Test Notification Button */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          if ('Notification' in window) {
                            if (Notification.permission === 'granted') {
                              new Notification('Claude Clone', {
                                body: 'This is a test notification from Claude Clone!',
                                icon: '/vite.svg'
                              });
                              showToast('Test notification sent!', 'success');
                            } else if (Notification.permission === 'denied') {
                              alert('Notifications are blocked. Please enable them in your browser settings.');
                            } else {
                              Notification.requestPermission().then(permission => {
                                if (permission === 'granted') {
                                  new Notification('Claude Clone', {
                                    body: 'This is a test notification from Claude Clone!',
                                    icon: '/vite.svg'
                                  });
                                  showToast('Test notification sent!', 'success');
                                } else {
                                  alert('Notification permission denied.');
                                }
                              });
                            }
                          } else {
                            alert('Your browser does not support notifications.');
                          }
                        }}
                        className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm transition-colors"
                      >
                        Send Test Notification
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm">Email notifications</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Receive notifications via email</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notificationSettings.emailNotifications}
                          onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                      </label>
                    </div>
                  </div>
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
                <div>
                  <label className="block text-sm font-medium mb-2">Max Tokens: {maxTokens}</label>
                  <input
                    type="range"
                    min="100"
                    max="8192"
                    step="100"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum tokens in response (higher = longer responses)</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <h5 className="font-medium text-sm">Extended Thinking</h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Show Claude's reasoning process</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={thinkingEnabled}
                      onChange={(e) => setThinkingEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Conversation System Prompt</label>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => onSystemPromptChange(e.target.value)}
                    placeholder="Enter a custom system prompt for this conversation..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-black dark:text-white resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">This system prompt is saved for this conversation only. Each conversation can have its own custom system prompt.</p>
                </div>
                {/* Custom Instruction Templates Section */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <h4 className="font-semibold text-lg mb-3">Custom Instructions</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-sm">Instruction Templates</h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Save and reuse custom instruction sets</p>
                      </div>
                      <button
                        onClick={openCustomInstructionModal}
                        className="px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-lg transition-colors"
                      >
                        Manage Templates
                      </button>
                    </div>
                    {/* Template Selector */}
                    {customInstructionTemplates.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-2">Apply a template:</label>
                        <div className="flex flex-wrap gap-2">
                          {customInstructionTemplates.slice(0, 4).map(template => (
                            <button
                              key={template.id}
                              onClick={() => selectInstructionTemplate(template)}
                              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                                selectedInstructionTemplate?.id === template.id
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500'
                              }`}
                            >
                              {template.name}
                            </button>
                          ))}
                          {customInstructionTemplates.length > 4 && (
                            <span className="px-3 py-1.5 text-xs text-gray-500">
                              +{customInstructionTemplates.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Current Custom Instructions */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs text-gray-500 dark:text-gray-400">Current instructions:</label>
                        <button
                          onClick={() => setShowInstructionsPreview(!showInstructionsPreview)}
                          className="px-3 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span>👁️</span>
                          <span>{showInstructionsPreview ? 'Hide Preview' : 'Preview'}</span>
                        </button>
                      </div>
                      <textarea
                        value={globalCustomInstructions}
                        onChange={(e) => setGlobalCustomInstructions(e.target.value)}
                        placeholder="Enter custom instructions for Claude..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-black dark:text-white resize-none"
                      />
                      {/* Instructions Preview Panel */}
                      {showInstructionsPreview && (
                        <div className="mt-4 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                          <h5 className="font-medium text-sm mb-3 text-gray-700 dark:text-gray-300">Test Your Instructions</h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                            Enter a test prompt to see how your custom instructions affect Claude's response.
                          </p>
                          <textarea
                            value={previewTestPrompt}
                            onChange={(e) => setPreviewTestPrompt(e.target.value)}
                            placeholder="Enter a test prompt (e.g., 'Hello, who are you?')..."
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-black dark:text-white resize-none mb-3"
                          />
                          <button
                            onClick={testInstructionsPreview}
                            disabled={previewLoading || !previewTestPrompt.trim()}
                            className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                          >
                            {previewLoading ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin">⏳</span>
                                Testing...
                              </span>
                            ) : (
                              'Test Instructions'
                            )}
                          </button>
                          {/* Preview Response */}
                          {previewResponse && (
                            <div className="mt-4">
                              <h6 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Preview Response:</h6>
                              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                {previewResponse}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
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
                <div>
                  <label className="block text-sm font-medium mb-2">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="en">English</option>
                    <option value="zh">中文 (Chinese)</option>
                    <option value="es">Español (Spanish)</option>
                    <option value="fr">Français (French)</option>
                    <option value="de">Deutsch (German)</option>
                    <option value="ja">日本語 (Japanese)</option>
                    <option value="ko">한국어 (Korean)</option>
                    <option value="pt">Português (Portuguese)</option>
                    <option value="ru">Русский (Russian)</option>
                    <option value="ar">العربية (Arabic)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Select your preferred language for date/time formatting</p>
                </div>
              </div>
            )}
            {activeTab === 'accessibility' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">Accessibility</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">High Contrast Mode</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Increase contrast for better readability</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={highContrast}
                        onChange={(e) => setHighContrast(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">Reduced Motion</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Minimize animations and transitions</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={reducedMotion}
                        onChange={(e) => setReducedMotion(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">Screen Reader Support</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Optimized for assistive technologies</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Text Size</label>
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm">Small</button>
                    <button className="flex-1 px-3 py-2 bg-primary-500 text-white rounded-lg text-sm">Medium</button>
                    <button className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm">Large</button>
                    <button className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm">Extra Large</button>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <h4 className="font-semibold text-lg">Privacy Settings</h4>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">Save Conversation History</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Store your conversations locally</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">Allow Analytics</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Help improve Claude Clone</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-sm">Auto-delete Old Messages</h5>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Automatically remove messages older than 30 days</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-500"></div>
                    </label>
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h5 className="font-medium text-sm mb-2">Data Management</h5>
                  <div className="space-y-2">
                    <button
                      onClick={onExportAllData}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg text-sm text-left transition-colors flex items-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      Export All Data
                    </button>
                    <button className="w-full px-3 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-sm text-red-600 dark:text-red-400 text-left transition-colors">
                      Delete All Conversations
                    </button>
                  </div>
                </div>
                {/* Active Sessions Section */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-sm">Active Sessions</h5>
                    <button
                      onClick={fetchActiveSessions}
                      className="text-xs text-primary-500 hover:text-primary-600"
                      disabled={sessionsLoading}
                    >
                      {sessionsLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    View and manage devices that are logged into your account.
                  </p>
                  {sessionsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                    </div>
                  ) : activeSessions.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {activeSessions.map(session => (
                        <div
                          key={session.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            session.isCurrent
                              ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                              : 'bg-white dark:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              session.device === 'Mobile'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                            }`}>
                              {session.device === 'Mobile' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
                                  <line x1="12" y1="18" x2="12.01" y2="18"></line>
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                  <line x1="8" y1="21" x2="16" y2="21"></line>
                                  <line x1="12" y1="17" x2="12" y2="21"></line>
                                </svg>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{session.browser}</span>
                                {session.isCurrent && (
                                  <span className="text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {session.device} - {session.location}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                Last active: {new Date(session.lastActive).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          {!session.isCurrent && (
                            <button
                              onClick={() => logoutSession(session.id)}
                              className="text-xs px-3 py-1 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded transition-colors"
                            >
                              Logout
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      No sessions found. Click refresh to load sessions.
                    </p>
                  )}
                  {activeSessions.filter(s => !s.isCurrent).length > 0 && (
                    <button
                      onClick={logoutOtherSessions}
                      className="mt-3 w-full px-3 py-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg text-sm transition-colors"
                    >
                      Logout All Other Sessions ({activeSessions.filter(s => !s.isCurrent).length})
                    </button>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'usage' && <UsageDashboard usageLimits={usageLimits} setUsageLimits={setUsageLimits} showToast={showToast} />}
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
                <div>
                  <button
                    onClick={onOpenKeyboardShortcuts}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors w-full"
                  >
                    <Icons.Search />
                    Keyboard Shortcuts
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Artifact Panel Component - displays artifacts in a side panel
function ArtifactPanel({
  artifact,
  isOpen,
  onClose,
  onFullscreen,
  isFullscreen,
  versions,
  onVersionChange,
  onEdit,
  onDownload,
  onRePrompt,
  artifactPanelTab,
  setArtifactPanelTab
}) {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const iframeRef = useRef(null);
  const [localTab, setLocalTab] = useState('code');
  const activeTab = artifactPanelTab !== undefined ? artifactPanelTab : localTab;
  const changeTab = setArtifactPanelTab || setLocalTab;

  if (!isOpen || !artifact) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguageDisplay = () => {
    const displayNames = {
      html: 'HTML',
      svg: 'SVG',
      react: 'React',
      jsx: 'React',
      tsx: 'React',
      mermaid: 'Mermaid',
      javascript: 'JavaScript',
      typescript: 'TypeScript',
      python: 'Python',
      css: 'CSS',
      json: 'JSON',
      text: 'Text'
    };
    return displayNames[artifact.language] || artifact.language?.toUpperCase() || 'CODE';
  };

  const renderPreview = () => {
    if (artifact.type === 'html') {
      // Create a data URL for the HTML content
      const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(artifact.content)}`;
      return (
        <iframe
          ref={iframeRef}
          src={dataUrl}
          className="w-full h-full bg-white rounded-lg border border-gray-300 dark:border-gray-600"
          title="HTML Preview"
        />
      );
    }

    if (artifact.type === 'svg') {
      // Sanitize SVG content to prevent XSS attacks
      const sanitizedSvg = DOMPurify.sanitize(artifact.content, {
        USE_PROFILES: { svg: true, svgFilters: true }
      });
      return (
        <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-300 dark:border-gray-600 overflow-auto">
          <div dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
        </div>
      );
    }

    if (artifact.type === 'mermaid') {
      // For mermaid, we'll show a simplified preview or the code
      return (
        <div className="w-full h-full bg-white dark:bg-gray-900 p-4 rounded-lg border border-gray-300 dark:border-gray-600 overflow-auto">
          <p className="text-sm text-gray-500 mb-2">Mermaid Diagram:</p>
          <pre className="text-xs whitespace-pre-wrap">{artifact.content}</pre>
        </div>
      );
    }

    return null;
  };

  const renderCodeView = () => {
    const lines = artifact.content.split('\n');

    return (
      <div className="relative h-full">
        <div className="absolute top-2 right-2 flex gap-2 z-10">
          <button
            onClick={handleCopy}
            className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 flex items-center gap-1 text-xs transition-colors"
          >
            <Icons.Copy />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <div className="flex h-full overflow-auto">
          {showLineNumbers && (
            <div className="flex-shrink-0 py-4 pl-4 pr-2 text-right text-gray-500 dark:text-gray-400 select-none bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
              {lines.map((_, i) => (
                <div key={i} className="text-xs leading-6">{i + 1}</div>
              ))}
            </div>
          )}
          <pre className="flex-1 p-4 overflow-auto bg-gray-50 dark:bg-gray-900">
            <code className={`language-${artifact.language || 'text'} text-sm leading-6`}>
              {artifact.content}
            </code>
          </pre>
        </div>
      </div>
    );
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'relative w-full h-full'} bg-white dark:bg-gray-800 flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-sm truncate max-w-[200px]">{artifact.title}</h3>
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {getLanguageDisplay()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Version selector if available */}
          {versions && versions.length > 1 && (
            <select
              onChange={(e) => onVersionChange && onVersionChange(versions[parseInt(e.target.value)])}
              className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 border-0"
            >
              {versions.map((v, i) => (
                <option key={i} value={i}>Version {i + 1}</option>
              ))}
            </select>
          )}
          <button
            onClick={onFullscreen}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Icons.Minimize2 /> : <Icons.Maximize2 />}
          </button>
          <button
            onClick={handleCopy}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Copy code"
          >
            <Icons.Copy />
          </button>
          <button
            onClick={onDownload}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Download"
          >
            <Icons.Download />
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="px-3 py-1 text-xs rounded bg-primary-500 hover:bg-primary-600 text-white transition-colors"
            >
              Edit
            </button>
          )}
          {onRePrompt && (
            <button
              onClick={onRePrompt}
              className="px-3 py-1 text-xs rounded border border-primary-500 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
            >
              Re-prompt
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs for previewable artifacts */}
      {(artifact.type === 'html' || artifact.type === 'svg' || artifact.type === 'mermaid') && (
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => changeTab('code')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'code'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Code
          </button>
          <button
            onClick={() => changeTab('preview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === 'preview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Preview
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'preview' && renderPreview()}
        {activeTab === 'code' && renderCodeView()}
      </div>
    </div>
  );
}

// Save Prompt Modal
function SavePromptModal({ isOpen, onClose, promptTitle, setPromptTitle, promptDescription, setPromptDescription, promptCategory, setPromptCategory, onSave, input }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Save Prompt to Library</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Prompt Preview */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Prompt</label>
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm max-h-32 overflow-auto">
            {input.length > 200 ? input.substring(0, 200) + '...' : input || 'No prompt entered'}
          </div>
        </div>

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Title</label>
          <input
            type="text"
            value={promptTitle}
            onChange={e => setPromptTitle(e.target.value)}
            placeholder="Enter prompt title"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-black dark:text-white"
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Description (optional)</label>
          <textarea
            value={promptDescription}
            onChange={e => setPromptDescription(e.target.value)}
            placeholder="Enter a description"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-black dark:text-white"
          />
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Category</label>
          <select
            value={promptCategory}
            onChange={e => setPromptCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-black dark:text-white"
          >
            <option value="General">General</option>
            <option value="Coding">Coding</option>
            <option value="Writing">Writing</option>
            <option value="Analysis">Analysis</option>
            <option value="Brainstorming">Brainstorming</option>
            <option value="Education">Education</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!promptTitle.trim()}
            className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Save Prompt
          </button>
        </div>
      </div>
    </div>
  );
}

// Prompt Library Modal
function PromptLibraryModal({ isOpen, onClose, prompts, onSelectPrompt, onDeletePrompt, onSaveNewPrompt, onEditPrompt, input }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTemplate, setEditTemplate] = useState('');
  const [editCategory, setEditCategory] = useState('General');
  const [localPrompts, setLocalPrompts] = useState(prompts);

  // Update local prompts when props change
  useEffect(() => {
    setLocalPrompts(prompts);
  }, [prompts]);

  // Increment usage count for a prompt
  const incrementPromptUsage = async (promptId) => {
    try {
      const response = await fetch(`${API_BASE}/prompts/library/${promptId}/use`, {
        method: 'POST'
      });
      if (response.ok) {
        const updatedPrompt = await response.json();
        setLocalPrompts(prev => prev.map(p => p.id === promptId ? updatedPrompt : p));
      }
    } catch (error) {
      console.error('Failed to increment prompt usage:', error);
    }
  };

  if (!isOpen) return null;

  const categories = ['All', ...new Set(localPrompts.map(p => p.category || 'General'))];
  const filteredPrompts = localPrompts.filter(p => {
    const matchesCategory = selectedCategory === 'All' || (p.category || 'General') === selectedCategory;
    const matchesSearch = searchQuery === '' ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.prompt_template?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Prompt Library</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {localPrompts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <Icons.Bookmark />
            </div>
            <h4 className="text-lg font-medium mb-2">No saved prompts</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
              Save useful prompts from your conversations to access them quickly later.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Type a message and click the bookmark icon to save it.
            </p>
          </div>
        ) : (
          <>
            {/* Search Input */}
            <div className="mb-4">
              <div className="relative">
                <Icons.Search />
                <input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent focus:border-primary-500 focus:outline-none transition-colors"
                  aria-label="Search prompts"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    aria-label="Clear search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedCategory === cat
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Prompts List */}
            <div className="flex-1 overflow-y-auto space-y-3">
              {filteredPrompts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400 mb-2">No prompts found</p>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-primary-500 hover:text-primary-600 text-sm"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : filteredPrompts.map(prompt => (
                <div
                  key={prompt.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium truncate">{prompt.title}</h4>
                        <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">
                          {prompt.category || 'General'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400" title="Times used">
                          ({prompt.usage_count || 0} uses)
                        </span>
                      </div>
                      {prompt.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                          {prompt.description}
                        </p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {prompt.prompt_template}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          incrementPromptUsage(prompt.id);
                          onSelectPrompt(prompt.prompt_template);
                          onClose();
                        }}
                        className="p-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                        title="Use prompt"
                      >
                        <Icons.Send />
                      </button>
                      <button
                        onClick={() => {
                          setEditingPrompt(prompt);
                          setEditTitle(prompt.title || '');
                          setEditDescription(prompt.description || '');
                          setEditTemplate(prompt.prompt_template || '');
                          setEditCategory(prompt.category || 'General');
                        }}
                        className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                        title="Edit prompt"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={() => onDeletePrompt(prompt.id)}
                        className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                        title="Delete prompt"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Edit Prompt Modal */}
        {editingPrompt && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
            onClick={() => setEditingPrompt(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Prompt</h3>
                <button
                  onClick={() => setEditingPrompt(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent focus:border-primary-500 focus:outline-none transition-colors"
                    placeholder="Enter prompt title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent focus:border-primary-500 focus:outline-none transition-colors"
                    placeholder="Brief description (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Template</label>
                  <textarea
                    value={editTemplate}
                    onChange={(e) => setEditTemplate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent focus:border-primary-500 focus:outline-none transition-colors min-h-[100px] font-mono text-sm"
                    placeholder="Enter prompt template"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent focus:border-primary-500 focus:outline-none transition-colors"
                  >
                    <option value="General">General</option>
                    <option value="Coding">Coding</option>
                    <option value="Writing">Writing</option>
                    <option value="Analysis">Analysis</option>
                    <option value="Creative">Creative</option>
                    <option value="Education">Education</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setEditingPrompt(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      onEditPrompt(editingPrompt.id, {
                        title: editTitle,
                        description: editDescription,
                        prompt_template: editTemplate,
                        category: editCategory,
                      });
                      setEditingPrompt(null);
                    }}
                    className="flex-1 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Login Page Component
function LoginPage({ onLogin, onNavigateToRegister, theme }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    // Load remember preference from localStorage
    return localStorage.getItem('rememberMe') === 'true';
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call for demo purposes
      await new Promise(resolve => setTimeout(resolve, 1000));

      // For demo, accept any valid-looking credentials
      if (emailRegex.test(email) && password.length >= 6) {
        // Use localStorage for persistent session (remember me checked)
        // Use sessionStorage for session-only (remember me unchecked)
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('isLoggedIn', 'true');
        storage.setItem('userEmail', email);
        // Always store remember preference in localStorage for the checkbox state
        localStorage.setItem('rememberMe', rememberMe.toString());
        onLogin({ name: email.split('@')[0], email, avatar: null });
      } else {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className={`w-full max-w-md p-8 rounded-2xl shadow-xl ${isDark ? 'bg-gray-800' : 'bg-white'}`}>
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-500">
              <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
              <path d="M12 2a10 10 0 0 1 10 10"/>
              <circle cx="12" cy="12" r="6"/>
            </svg>
          </div>
          <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Welcome Back</h1>
          <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Sign in to continue to Claude
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Input */}
          <div>
            <label htmlFor="login-email" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Email address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full px-4 py-3 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              } ${error && !email ? 'border-red-500' : ''}`}
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="login-password" className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full px-4 py-3 pr-12 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                } ${error && !password ? 'border-red-500' : ''}`}
                aria-describedby={error ? 'login-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-primary-500 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
            />
            <label htmlFor="remember-me" className={`ml-2 text-sm cursor-pointer ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Remember me
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div id="login-error" className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" role="alert">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              loading
                ? 'bg-primary-400 cursor-not-allowed'
                : 'bg-primary-500 hover:bg-primary-600'
            } text-white`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing in...
              </span>
            ) : (
              'Sign in'
            )}
          </button>

          {/* Demo Credentials */}
          <div className={`mt-4 p-3 rounded-lg ${isDark ? 'bg-gray-700' : 'bg-gray-50'}`}>
            <p className={`text-xs text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Demo: Enter any email and password (6+ chars) to login
            </p>
          </div>
        </form>

        {/* Footer Links */}
        <div className="mt-6 text-center">
          <a href="#" className={`text-sm hover:underline ${isDark ? 'text-primary-400' : 'text-primary-500'}`}>
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}

// Helper function to load setting from localStorage
const loadSetting = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try {
      return JSON.parse(saved);
    } catch {
      return saved;
    }
  }
  return defaultValue;
};

// Main App component
function App() {
  // State - load from localStorage
  const [theme, setTheme] = useState(() => loadSetting('app_theme', 'system'));
  const [highContrast, setHighContrast] = useState(() => loadSetting('app_highContrast', false));
  const [reducedMotion, setReducedMotion] = useState(() => loadSetting('app_reducedMotion', false));
  const [language, setLanguage] = useState(() => loadSetting('app_language', 'en'));
  const [conversations, setConversations] = useState([]);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [expandedThreads, setExpandedThreads] = useState([]); // Track which message threads are expanded
  const [input, setInput] = useState('');
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashCommandIndex, setSlashCommandIndex] = useState(0);
  const [slashFilter, setSlashFilter] = useState('');

  // Mention bot state
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionFilter, setMentionFilter] = useState('');

  // Bot mention suggestions
  const mentionSuggestions = [
    { id: 'bot', label: 'Claude Bot', description: 'AI assistant', icon: 'bot' },
  ];

  // Filter mention suggestions based on input after "@"
  const filteredMentions = mentionSuggestions.filter(m =>
    m.label.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    m.description.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  // Slash commands configuration
  const slashCommands = [
    { command: 'new', label: 'New Chat', description: 'Start a new conversation', icon: 'plus', action: () => handleNewChat() },
    { command: 'clear', label: 'Clear Chat', description: 'Clear current messages', icon: 'trash', action: () => { setMessages([]); setInput(''); } },
    { command: 'search', label: 'Search', description: 'Search conversations', icon: 'search', action: () => { setShowCommandPalette(true); setInput(''); } },
    { command: 'settings', label: 'Settings', description: 'Open settings', icon: 'settings', action: () => { setShowSettings(true); setInput(''); } },
    { command: 'export', label: 'Export Chat', description: 'Export current conversation', icon: 'download', action: () => { handleExportConversation('json'); setInput(''); } },
    { command: 'model', label: 'Change Model', description: 'Switch AI model', icon: 'cpu', action: () => { setShowModelSelector(true); setInput(''); } },
    { command: 'theme', label: 'Toggle Theme', description: 'Switch between light/dark mode', icon: 'moon', action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); setInput(''); } },
    { command: 'focus', label: 'Focus Mode', description: 'Toggle focus mode', icon: 'maximize', action: () => { setFocusMode(prev => !prev); setInput(''); } },
    { command: 'help', label: 'Show Help', description: 'Display keyboard shortcuts', icon: 'help', action: () => { setShowKeyboardShortcuts(true); setInput(''); } },
    { command: 'pin', label: 'Pin Conversation', description: 'Pin current conversation', icon: 'pin', action: () => { if (currentConversation) togglePinConversation(currentConversation.id); setInput(''); } },
    { command: 'archive', label: 'Archive Chat', description: 'Archive current conversation', icon: 'archive', action: () => { if (currentConversation) toggleArchiveConversation(currentConversation.id); setInput(''); } },
    { command: 'prompt', label: 'Prompt Library', description: 'Open prompt library', icon: 'bookmark', action: () => { setShowPromptLibrary(true); setInput(''); } },
  ];

  // Filter slash commands based on input after "/"
  const filteredSlashCommands = slashCommands.filter(cmd =>
    cmd.command.includes(slashFilter.toLowerCase()) ||
    cmd.label.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // Model selection state - must be before totalConversationCost calculation
  const [selectedModel, setSelectedModel] = useState(() => loadSetting('app_selectedModel', 'claude-sonnet-4-5-20250929'));

  // Calculate total conversation cost
  const totalConversationCost = useMemo(() => {
    const model = currentConversation?.model || selectedModel;
    return messages.reduce((total, msg) => {
      return total + calculateMessageCost(msg.inputTokens || 0, msg.outputTokens || 0, model);
    }, 0);
  }, [messages, currentConversation, selectedModel]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [temperature, setTemperature] = useState(() => loadSetting('app_temperature', 0.7));
  const [topP, setTopP] = useState(() => loadSetting('app_topP', 1.0));
  const [maxTokens, setMaxTokens] = useState(() => loadSetting('app_maxTokens', 4096));
  const [showSettings, setShowSettings] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false); // Focus mode - hides sidebar for distraction-free chat
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebarWidth');
    return saved ? parseInt(saved, 10) : 288; // Default 288px (w-72)
  });
  const [isResizing, setIsResizing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [conversationSort, setConversationSort] = useState('newest'); // newest, oldest, alphabetical
  const [bulkSelectMode, setBulkSelectMode] = useState(false); // Bulk select mode for conversations
  const [selectedConversations, setSelectedConversations] = useState([]); // Selected conversations for bulk actions
  const [abortController, setAbortController] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingConversationId, setDeletingConversationId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    // Restore user profile from localStorage if exists
    const savedProfile = localStorage.getItem('userProfile');
    if (savedProfile) {
      try {
        return JSON.parse(savedProfile);
      } catch {
        return { name: 'Demo User', avatar: null };
      }
    }
    return { name: 'Demo User', avatar: null };
  });
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(() => loadSetting('soundEffectsEnabled', true));
  const [notificationSettings, setNotificationSettings] = useState(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : {
      newMessageNotifications: true,
      conversationActivity: true,
      soundEnabled: true,
      desktopNotifications: false,
      emailNotifications: false,
      mentionNotifications: true
    };
  });
  const [folders, setFolders] = useState([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#CC785C');
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [folderTab, setFolderTab] = useState('details'); // 'details' | 'analytics' | 'knowledge'
  const [folderAnalytics, setFolderAnalytics] = useState(null);

  // Conversation preview state
  const [previewConversationId, setPreviewConversationId] = useState(null);
  const [previewConversationTitle, setPreviewConversationTitle] = useState('');
  const [previewPosition, setPreviewPosition] = useState(null);
  const [previewMessages, setPreviewMessages] = useState([]);
  const [hoverPreviewLoading, setHoverPreviewLoading] = useState(false);
  const previewTimeoutRef = useRef(null);
  const [folderAnalyticsLoading, setFolderAnalyticsLoading] = useState(false);
  const [knowledgeBaseFiles, setKnowledgeBaseFiles] = useState([]);
  const [knowledgeBaseLoading, setKnowledgeBaseLoading] = useState(false);
  const [knowledgeBaseUploading, setKnowledgeBaseUploading] = useState(false);
  const [showLoginPage, setShowLoginPage] = useState(() => {
    // Check if user is logged in from localStorage (persistent) or sessionStorage (session-only)
    const savedLoginState = localStorage.getItem('isLoggedIn') || sessionStorage.getItem('isLoggedIn');
    return savedLoginState !== 'true';
  });
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Project color options
  const folderColors = [
    { id: 'default', color: '#CC785C', name: 'Default (Orange)' },
    { id: 'blue', color: '#3B82F6', name: 'Blue' },
    { id: 'green', color: '#10B981', name: 'Green' },
    { id: 'purple', color: '#8B5CF6', name: 'Purple' },
    { id: 'red', color: '#EF4444', name: 'Red' },
    { id: 'yellow', color: '#F59E0B', name: 'Yellow' },
    { id: 'pink', color: '#EC4899', name: 'Pink' },
    { id: 'gray', color: '#6B7280', name: 'Gray' },
  ];
  const [expandedFolders, setExpandedFolders] = useState([]);

  // Project templates
  const projectTemplates = [
    {
      id: 'blank',
      name: 'Blank Project',
      description: 'Start with a clean slate',
      icon: '📄',
      customInstructions: ''
    },
    {
      id: 'coding',
      name: 'Coding Assistant',
      description: 'Focused on code review, debugging, and programming help',
      icon: '💻',
      customInstructions: 'You are an expert programming assistant. Focus on writing clean, efficient, and well-documented code. Provide code examples with explanations. Help debug issues by analyzing error messages and suggesting solutions.'
    },
    {
      id: 'writing',
      name: 'Writing Assistant',
      description: 'For content creation, editing, and brainstorming',
      icon: '✍️',
      customInstructions: 'You are a skilled writing assistant. Help with creative writing, editing, and content creation. Provide constructive feedback on clarity, style, and structure. Suggest improvements while respecting the author voice.'
    },
    {
      id: 'research',
      name: 'Research Helper',
      description: 'Analyze information and summarize findings',
      icon: '🔬',
      customInstructions: 'You are a research assistant. Help analyze information, summarize complex topics, and present findings clearly. Cite sources when possible and maintain objectivity. Break down complex concepts into understandable parts.'
    },
    {
      id: 'brainstorm',
      name: 'Brainstorming',
      description: 'Generate creative ideas and explore possibilities',
      icon: '💡',
      customInstructions: 'You are a creative brainstorming partner. Generate diverse ideas without judgment. Build on suggestions and explore unconventional approaches. Help organize and refine ideas into actionable plans.'
    }
  ];
  const [showMoveToFolderMenu, setShowMoveToFolderMenu] = useState(false);
  const [movingConversationId, setMovingConversationId] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [exportFormat, setExportFormat] = useState('json');
  const [batchExportData, setBatchExportData] = useState(null);
  const [showBatchExportModal, setShowBatchExportModal] = useState(false);
  const [batchExportFormat, setBatchExportFormat] = useState('json');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editedMessageContent, setEditedMessageContent] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(''); // System prompt override
  const [shareData, setShareData] = useState(null);
  const [shareLink, setShareLink] = useState('');
  const [sharedView, setSharedView] = useState(null); // For shared conversation view
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedError, setSharedError] = useState(null);
  const [shareExpiration, setShareExpiration] = useState(30); // days, 0 = no expiration
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]); // Base64 encoded images
  const [isDragging, setIsDragging] = useState(false); // Drag and drop state
  const [lightboxImage, setLightboxImage] = useState(null); // Image for lightbox view
  const [artifacts, setArtifacts] = useState([]); // Artifacts from Claude responses
  const [activeArtifact, setActiveArtifact] = useState(null); // Currently active artifact
  const [isArtifactPanelOpen, setIsArtifactPanelOpen] = useState(false); // Artifact panel visibility
  const [artifactPanelTab, setArtifactPanelTab] = useState('code'); // 'code' or 'preview'
  const [isArtifactFullscreen, setIsArtifactFullscreen] = useState(false); // Fullscreen mode
  const [artifactVersions, setArtifactVersions] = useState({}); // Version history per artifact
  const [editingArtifact, setEditingArtifact] = useState(null); // Artifact being edited
  const [responseSuggestions, setResponseSuggestions] = useState([]); // Suggested follow-up prompts
  const [showSavePromptModal, setShowSavePromptModal] = useState(false); // Save prompt modal visibility
  const [showPromptLibrary, setShowPromptLibrary] = useState(false); // Prompt library modal visibility
  const [savedPrompts, setSavedPrompts] = useState([]); // Saved prompts from library
  const [promptTitle, setPromptTitle] = useState(''); // Title for new prompt
  const [promptDescription, setPromptDescription] = useState(''); // Description for new prompt
  const [promptCategory, setPromptCategory] = useState('General'); // Category for new prompt
  const [toasts, setToasts] = useState([]); // Toast notifications
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true); // Network status
  const [networkError, setNetworkError] = useState(null); // Network error message
  const [showNetworkBanner, setShowNetworkBanner] = useState(false); // Show network error banner
  const [isRecovering, setIsRecovering] = useState(false); // Recovery in progress
  const [lastFailedMessage, setLastFailedMessage] = useState(null); // Store last failed message for retry
  const [usageLimits, setUsageLimits] = useState(() => {
    const saved = localStorage.getItem('usageLimits');
    return saved ? JSON.parse(saved) : { enabled: false, monthlyTokenLimit: 1000000, dailyCostLimit: 10, warningThreshold: 80 };
  }); // Usage limits configuration
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false); // Markdown preview toggle
  const [customInstructionTemplates, setCustomInstructionTemplates] = useState(() => {
    const saved = localStorage.getItem('customInstructionTemplates');
    return saved ? JSON.parse(saved) : [
      { id: 'default-coding', name: 'Coding Assistant', instructions: 'You are an expert programming assistant. Focus on writing clean, efficient, and well-documented code. Provide code examples with explanations.' },
      { id: 'default-writing', name: 'Writing Assistant', instructions: 'You are a skilled writing assistant. Help with creative writing, editing, and content creation. Provide constructive feedback on clarity, style, and structure.' },
      { id: 'default-research', name: 'Research Helper', instructions: 'You are a research assistant. Help analyze information, summarize complex topics, and present findings clearly. Cite sources when possible.' }
    ];
  }); // User-defined custom instruction templates
  const [showCustomInstructionModal, setShowCustomInstructionModal] = useState(false); // Custom instruction modal
  const [selectedInstructionTemplate, setSelectedInstructionTemplate] = useState(null); // Selected template
  const [editingInstructionTemplate, setEditingInstructionTemplate] = useState(null); // Template being edited
  const [newTemplateName, setNewTemplateName] = useState(''); // Name for new template
  const [newTemplateInstructions, setNewTemplateInstructions] = useState(''); // Instructions for new template
  const [globalCustomInstructions, setGlobalCustomInstructions] = useState(() => {
    return localStorage.getItem('globalCustomInstructions') || '';
  }); // Global custom instructions
  const [showInstructionsPreview, setShowInstructionsPreview] = useState(false); // Instructions preview panel
  const [previewTestPrompt, setPreviewTestPrompt] = useState(''); // Test prompt for instructions preview
  const [previewResponse, setPreviewResponse] = useState(''); // Preview response from Claude
  const [previewLoading, setPreviewLoading] = useState(false); // Preview loading state

  // Active Sessions state
  const [activeSessions, setActiveSessions] = useState([]); // List of active sessions
  const [sessionsLoading, setSessionsLoading] = useState(false); // Loading state for sessions

  // Fetch active sessions
  const fetchActiveSessions = async () => {
    setSessionsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  };

  // Logout a specific session
  const logoutSession = async (sessionId) => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setActiveSessions(prev => prev.filter(s => s.id !== sessionId));
        showToast('Session logged out successfully', 'success');
      }
    } catch (error) {
      console.error('Failed to logout session:', error);
      showToast('Failed to logout session', 'error');
    }
  };

  // Logout all other sessions
  const logoutOtherSessions = async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions/other`, {
        method: 'DELETE'
      });
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(prev => prev.filter(s => s.isCurrent));
        showToast(data.message || 'All other sessions logged out', 'success');
      }
    } catch (error) {
      console.error('Failed to logout other sessions:', error);
      showToast('Failed to logout other sessions', 'error');
    }
  };

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [undoMessage, setUndoMessage] = useState(null); // Stores last sent message for undo
  const [undoTimeout, setUndoTimeout] = useState(null); // Timer reference for undo
  const [highlightedMessageId, setHighlightedMessageId] = useState(null); // For message reference highlighting

  // Scroll to a specific message when reference is clicked
  const scrollToMessage = (messageRef) => {
    // Parse the message reference (could be msg:xxx or msg-xxx format)
    const refId = messageRef.replace('msg:', '').replace('msg-', '');
    const targetElement = document.getElementById(`message-${refId}`);

    if (targetElement) {
      // Highlight the message briefly
      setHighlightedMessageId(refId);

      // Scroll to the message
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Remove highlight after animation
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2000);
    }
  };

  // Undo last sent message (within time limit)
  const undoSendMessage = () => {
    if (!undoMessage) return;

    // Remove the message from state
    setMessages(prev => prev.filter(msg => msg.id !== undoMessage.id));

    // Restore content to input
    setInput(undoMessage.content);
    if (undoMessage.images && undoMessage.images.length > 0) {
      setUploadedImages(undoMessage.images);
    }

    // Clear undo state
    if (undoTimeout) {
      clearTimeout(undoTimeout);
      setUndoTimeout(null);
    }
    setUndoMessage(null);

    // Show toast
    showToast('Message undone', 'info');

    // Focus input
    inputRef.current?.focus();
  };

  // Show toast notification
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Remove toast manually
  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Custom instruction template management functions
  const openCustomInstructionModal = () => {
    setEditingInstructionTemplate(null);
    setNewTemplateName('');
    setNewTemplateInstructions('');
    setShowCustomInstructionModal(true);
  };

  const editTemplate = (template) => {
    setEditingInstructionTemplate(template);
    setNewTemplateName(template.name);
    setNewTemplateInstructions(template.instructions);
    setShowCustomInstructionModal(true);
  };

  const deleteTemplate = (templateId) => {
    setCustomInstructionTemplates(prev => prev.filter(t => t.id !== templateId));
    showToast('Template deleted', 'success');
  };

  const saveTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateInstructions.trim()) {
      showToast('Please fill in both name and instructions', 'error');
      return;
    }

    if (editingInstructionTemplate) {
      // Update existing template
      setCustomInstructionTemplates(prev =>
        prev.map(t => t.id === editingInstructionTemplate.id
          ? { ...t, name: newTemplateName.trim(), instructions: newTemplateInstructions.trim() }
          : t
        )
      );
      showToast('Template updated', 'success');
    } else {
      // Create new template
      const newTemplate = {
        id: `custom-${Date.now()}`,
        name: newTemplateName.trim(),
        instructions: newTemplateInstructions.trim()
      };
      setCustomInstructionTemplates(prev => [...prev, newTemplate]);
      showToast('Template created', 'success');
    }

    setShowCustomInstructionModal(false);
    setEditingInstructionTemplate(null);
    setNewTemplateName('');
    setNewTemplateInstructions('');
  };

  const selectInstructionTemplate = (template) => {
    setSelectedInstructionTemplate(template);
    setGlobalCustomInstructions(template.instructions);
    showToast(`Template "${template.name}" applied`, 'success');
  };

  // Test custom instructions preview
  const testInstructionsPreview = async () => {
    if (!previewTestPrompt.trim()) {
      showToast('Please enter a test prompt', 'error');
      return;
    }

    setPreviewLoading(true);
    setPreviewResponse('');

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: previewTestPrompt,
          system_prompt: globalCustomInstructions.trim() || undefined,
          model: selectedModel,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewResponse(data.response || 'No response received');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setPreviewResponse(`Error: ${errorData.error || response.statusText || 'Failed to get response'}`);
      }
    } catch (err) {
      setPreviewResponse(`Error: ${err.message || 'Network error'}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Apply reduced motion
  useEffect(() => {
    if (reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }, [reducedMotion]);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('app_theme', JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('app_highContrast', JSON.stringify(highContrast));
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem('app_reducedMotion', JSON.stringify(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem('app_selectedModel', JSON.stringify(selectedModel));
  }, [selectedModel]);

  useEffect(() => {
    localStorage.setItem('app_temperature', JSON.stringify(temperature));
  }, [temperature]);

  useEffect(() => {
    localStorage.setItem('app_topP', JSON.stringify(topP));
  }, [topP]);

  useEffect(() => {
    localStorage.setItem('app_maxTokens', JSON.stringify(maxTokens));
  }, [maxTokens]);

  useEffect(() => {
    localStorage.setItem('app_language', JSON.stringify(language));
  }, [language]);

  // Save usage limits to localStorage
  useEffect(() => {
    localStorage.setItem('usageLimits', JSON.stringify(usageLimits));
  }, [usageLimits]);

  // Save custom instruction templates to localStorage
  useEffect(() => {
    localStorage.setItem('customInstructionTemplates', JSON.stringify(customInstructionTemplates));
  }, [customInstructionTemplates]);

  // Save global custom instructions to localStorage
  useEffect(() => {
    localStorage.setItem('globalCustomInstructions', globalCustomInstructions);
  }, [globalCustomInstructions]);

  // Save notification settings to localStorage
  useEffect(() => {
    localStorage.setItem('notificationSettings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // Auto-save draft message to localStorage
  useEffect(() => {
    if (currentConversation?.id && input) {
      localStorage.setItem(`draft_${currentConversation.id}`, input);
    }
  }, [input, currentConversation?.id]);

  // Restore draft message when switching conversations
  useEffect(() => {
    if (currentConversation?.id) {
      const savedDraft = localStorage.getItem(`draft_${currentConversation.id}`);
      if (savedDraft && !input) {
        setInput(savedDraft);
      }
    }
  }, [currentConversation?.id]);

  // Clear draft when message is sent
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'user') {
        // Clear draft after user sends message
        const draftKey = `draft_${currentConversation?.id}`;
        if (localStorage.getItem(draftKey)) {
          localStorage.removeItem(draftKey);
        }
      }
    }
  }, [messages, isLoading, currentConversation?.id]);

  // Save sidebar width to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarWidth', sidebarWidth.toString());
  }, [sidebarWidth]);

  // Handle mouse events for sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = Math.max(200, Math.min(500, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Network status event listeners
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network: Online');
      setIsOnline(true);
      // If there was a network error and we're back online, trigger recovery
      if (networkError || showNetworkBanner) {
        setIsRecovering(true);
        showToast('Network connection restored. Retrying...', 'success');
        // Attempt to reconnect and resume any pending operations
        setTimeout(() => {
          setShowNetworkBanner(false);
          setNetworkError(null);
          setIsRecovering(false);
          showToast('Connected successfully', 'success');
        }, 2000);
      }
    };

    const handleOffline = () => {
      console.log('Network: Offline');
      setIsOnline(false);
      setNetworkError('Network connection lost. Please check your internet connection.');
      setShowNetworkBanner(true);
      showToast('Network connection lost', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [networkError, showNetworkBanner]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
    loadFolders();
  }, []);

  // Load conversation from URL when conversations are loaded
  useEffect(() => {
    if (conversations.length === 0) return;

    const path = window.location.pathname;
    const convMatch = path.match(/^\/conversation\/([a-zA-Z0-9]+)$/);
    if (convMatch) {
      const conversationId = convMatch[1];
      const conv = conversations.find(c => c.id === conversationId);
      if (conv) {
        selectConversation(conv);
      }
    }
  }, [conversations]);

  // Update browser tab title based on current conversation
  useEffect(() => {
    if (currentConversation?.title) {
      document.title = `${currentConversation.title} - Claude Clone`;
    } else if (messages.length > 0) {
      // Use first message content as title if no title set
      const firstUserMessage = messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        const title = firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '');
        document.title = `${title} - Claude Clone`;
      }
    } else {
      document.title = 'Claude Clone';
    }
  }, [currentConversation, messages]);

  // Dynamic favicon based on conversation
  useEffect(() => {
    // Store original favicon
    const linkId = 'dynamic-favicon';
    let link = document.getElementById(linkId);
    const originalFavicon = '/vite.svg';

    if (!link) {
      link = document.createElement('link');
      link.id = linkId;
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }

    const updateFavicon = () => {
      if (currentConversation?.title) {
        // Generate a simple colored favicon based on conversation title
        const title = currentConversation.title;
        const colors = ['#CC785C', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
        const colorIndex = title.charCodeAt(0) % colors.length;
        const color = colors[colorIndex];
        const initial = title.charAt(0).toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="${color}"/><text x="50" y="68" font-family="Arial,sans-serif" font-size="55" font-weight="bold" text-anchor="middle" fill="white">${initial}</text></svg>`;
        const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        link.href = dataUrl;
      } else {
        // Restore original favicon
        link.href = originalFavicon;
      }
    };

    updateFavicon();

    // Cleanup: restore original favicon on unmount
    return () => {
      link.href = originalFavicon;
    };
  }, [currentConversation]);

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

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = async (event) => {
      const path = window.location.pathname;
      const convMatch = path.match(/^\/conversation\/([a-zA-Z0-9]+)$/);

      if (convMatch) {
        const conversationId = convMatch[1];
        const conv = conversations.find(c => c.id === conversationId);
        if (conv) {
          setCurrentConversation(conv);
          // Fetch messages for the conversation
          try {
            const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`);
            if (response.ok) {
              const data = await response.json();
              setMessages(Array.isArray(data) ? data : (data.messages || []));
            }
            const convResponse = await fetch(`${API_BASE}/conversations/${conversationId}`);
            if (convResponse.ok) {
              const convData = await convResponse.json();
              if (convData.system_prompt !== undefined) {
                setSystemPrompt(convData.system_prompt || '');
              }
            }
          } catch (error) {
            console.error('Failed to load messages on navigation:', error);
          }
        }
      } else if (path === '/' || path === '') {
        // Return to home - clear current conversation
        setCurrentConversation(null);
        setMessages([]);
        setSystemPrompt('');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [conversations]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Command palette keyboard shortcut (Cmd/Ctrl+K) and Keyboard Shortcuts (Cmd/Ctrl+/) and Dark Mode (Cmd/Ctrl+Shift+L) and Focus Mode (Cmd/Ctrl+Shift+F)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShowKeyboardShortcuts(prev => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setTheme(theme === 'dark' ? 'light' : 'dark');
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setFocusMode(prev => !prev);
      }
      // Logout shortcut: Cmd/Ctrl+Shift+Q
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Q') {
        e.preventDefault();
        handleLogout();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [theme]);

  // Load conversations from API
  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_BASE}/conversations`);
      if (response.ok) {
        const data = await response.json();
        // Backend returns array directly, not wrapped in { conversations: [...] }
        setConversations(Array.isArray(data) ? data : (data.conversations || []));
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  // Create new conversation
  const createConversation = async () => {
    try {
      console.log('createConversation: Starting');
      const response = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });
      console.log('createConversation: Response status:', response.status);
      if (response.ok) {
        const conversation = await response.json();
        console.log('createConversation: Got conversation:', conversation?.id);
        // Backend returns conversation directly, not wrapped in { conversation: {...} }
        const conv = conversation.conversation || conversation;
        setConversations(prev => [conv, ...prev]);
        setCurrentConversation(conv);
        setMessages([]);
        setResponseSuggestions([]); // Clear suggestions for new conversation
        // Update URL for new conversation
        const newUrl = `/conversation/${conv.id}`;
        window.history.pushState({ conversationId: conv.id }, '', newUrl);
        document.title = 'New Chat - Claude';
        return conv;
      } else {
        console.error('createConversation: Failed with status', response.status);
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

  // Bulk delete conversations
  const bulkDeleteConversations = async () => {
    if (selectedConversations.length === 0) return;
    try {
      // Delete all selected conversations
      const deletePromises = selectedConversations.map(id =>
        fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      // Update local state
      setConversations(prev => prev.filter(c => !selectedConversations.includes(c.id)));
      if (currentConversation && selectedConversations.includes(currentConversation.id)) {
        setCurrentConversation(null);
        setMessages([]);
      }

      // Clear selection
      setSelectedConversations([]);
      setBulkSelectMode(false);
    } catch (error) {
      console.error('Failed to bulk delete conversations:', error);
    }
  };

  // Bulk archive/unarchive conversations
  const bulkArchiveConversations = async () => {
    if (selectedConversations.length === 0) return;
    try {
      const archivePromises = selectedConversations.map(id =>
        fetch(`${API_BASE}/conversations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_archived: true }),
        })
      );
      await Promise.all(archivePromises);

      // Update local state
      setConversations(prev => prev.map(c =>
        selectedConversations.includes(c.id) ? { ...c, is_archived: true } : c
      ));

      // Clear selection
      setSelectedConversations([]);
      setBulkSelectMode(false);
    } catch (error) {
      console.error('Failed to bulk archive conversations:', error);
    }
  };

  // Bulk pin/unpin conversations
  const bulkPinConversations = async () => {
    if (selectedConversations.length === 0) return;
    try {
      const pinPromises = selectedConversations.map(id =>
        fetch(`${API_BASE}/conversations/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_pinned: true }),
        })
      );
      await Promise.all(pinPromises);

      // Update local state
      setConversations(prev => prev.map(c =>
        selectedConversations.includes(c.id) ? { ...c, is_pinned: true } : c
      ));

      // Clear selection
      setSelectedConversations([]);
      setBulkSelectMode(false);
    } catch (error) {
      console.error('Failed to bulk pin conversations:', error);
    }
  };

  // Select/deselect conversation in bulk mode
  const toggleConversationSelection = (conversationId) => {
    setSelectedConversations(prev =>
      prev.includes(conversationId)
        ? prev.filter(id => id !== conversationId)
        : [...prev, conversationId]
    );
  };

  // Select all conversations
  const selectAllConversations = () => {
    const allIds = filteredConversations.map(c => c.id);
    setSelectedConversations(allIds);
  };

  // Deselect all conversations
  const deselectAllConversations = () => {
    setSelectedConversations([]);
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

  // Toggle conversation read/unread status
  const toggleConversationUnread = async (conversation) => {
    try {
      const newUnreadStatus = !conversation.is_unread;
      const response = await fetch(`${API_BASE}/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_unread: newUnreadStatus }),
      });

      if (response.ok) {
        // Update local state
        setConversations(prev => prev.map(c =>
          c.id === conversation.id ? { ...c, is_unread: newUnreadStatus } : c
        ));
      }
    } catch (error) {
      console.error('Failed to toggle unread status:', error);
    }
  };

  // Toggle conversation favorite status
  const toggleConversationFavorite = async (conversation) => {
    try {
      const newFavoriteStatus = !conversation.is_favorited;
      const response = await fetch(`${API_BASE}/conversations/${conversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorited: newFavoriteStatus }),
      });

      if (response.ok) {
        // Update local state
        setConversations(prev => prev.map(c =>
          c.id === conversation.id ? { ...c, is_favorited: newFavoriteStatus } : c
        ));
        // Show toast feedback
        showToast(newFavoriteStatus ? 'Added to favorites' : 'Removed from favorites', 'success');
      }
    } catch (error) {
      console.error('Failed to toggle favorite status:', error);
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

  // Delete message
  const deleteMessage = async (message) => {
    try {
      await fetch(`${API_BASE}/messages/${message.id}`, {
        method: 'DELETE',
      });
      // Remove message from local state
      setMessages(prev => prev.filter(msg => msg.id !== message.id));
      // Show toast
      showToast('Message deleted', 'success');
    } catch (error) {
      console.error('Error deleting message:', error);
      showToast('Failed to delete message', 'error');
    }
  };

  // Branch conversation from a specific message
  const branchConversation = async (message) => {
    try {
      // Find the index of the message in the current messages array
      const messageIndex = messages.findIndex(msg => msg.id === message.id);
      if (messageIndex === -1) return;

      // Get messages up to and including the branch point
      const branchMessages = messages.slice(0, messageIndex + 1);

      // Create a new conversation
      const response = await fetch(`${API_BASE}/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Branch from: ${currentConversation?.title || 'Chat'}`
        }),
      });
      const data = await response.json();
      const newConversation = data.conversation || data;

      // Add messages to the new conversation
      for (const msg of branchMessages) {
        await fetch(`${API_BASE}/conversations/${newConversation.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: msg.role,
            content: msg.content,
            images: msg.images
          }),
        });
      }

      // Reload conversations list
      loadConversations();

      // Select the new conversation
      selectConversation(newConversation.id);

      // Show toast
      showToast('Branch created', 'success');
    } catch (error) {
      console.error('Error branching conversation:', error);
      showToast('Failed to create branch', 'error');
    }
  };

  // Share conversation via link
  const shareConversation = async (conversation) => {
    try {
      // Reset share state for new share
      setShareExpiration(30);
      setShareLink('');
      setShareData(null);

      const response = await fetch(`${API_BASE}/conversations/${conversation.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expires_in_days: shareExpiration || 0 }),
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

  // Merge conversations
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeSourceConversation, setMergeSourceConversation] = useState(null);
  const [mergeTargetConversation, setMergeTargetConversation] = useState(null);
  const [isMerging, setIsMerging] = useState(false);

  const initiateMerge = (conversation) => {
    setMergeSourceConversation(conversation);
    setMergeTargetConversation(null);
    setShowMergeModal(true);
  };

  const mergeConversations = async () => {
    if (!mergeSourceConversation || !mergeTargetConversation) return;

    setIsMerging(true);
    try {
      const response = await fetch(`${API_BASE}/conversations/${mergeTargetConversation.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_conversation_id: mergeSourceConversation.id }),
      });

      if (response.ok) {
        const data = await response.json();
        showToast(`Merged ${data.messages_moved} messages into ${mergeTargetConversation.title || 'conversation'}`, 'success');

        // If we merged the current conversation, refresh it
        if (currentConversation?.id === mergeSourceConversation.id) {
          // Switch to the target conversation
          const targetConv = conversations.find(c => c.id === mergeTargetConversation.id);
          if (targetConv) {
            selectConversation(targetConv.id);
          }
        }

        // Reload conversations list
        loadConversations();
        setShowMergeModal(false);
        setMergeSourceConversation(null);
        setMergeTargetConversation(null);
      } else {
        const error = await response.json();
        showToast(error.error || 'Failed to merge conversations', 'error');
      }
    } catch (error) {
      console.error('Failed to merge conversations:', error);
      showToast('Failed to merge conversations', 'error');
    } finally {
      setIsMerging(false);
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

  // Batch export all data (conversations, messages, projects, settings)
  const exportAllData = async () => {
    try {
      setShowBatchExportModal(true);

      // Fetch all conversations
      const convResponse = await fetch(`${API_BASE}/conversations`);
      const allConversations = convResponse.ok ? (await convResponse.json()) : [];

      // Fetch messages for each conversation
      const conversationsWithMessages = await Promise.all(
        allConversations.map(async (conv) => {
          try {
            const msgResponse = await fetch(`${API_BASE}/conversations/${conv.id}/messages`);
            const msgData = msgResponse.ok ? await msgResponse.json() : { messages: [] };
            return {
              ...conv,
              messages: msgData.messages || []
            };
          } catch {
            return { ...conv, messages: [] };
          }
        })
      );

      // Fetch all projects
      let allProjects = [];
      try {
        const projResponse = await fetch(`${API_BASE}/projects`);
        if (projResponse.ok) {
          allProjects = await projResponse.json();
        }
      } catch {
        // Projects might not be available
      }

      // Fetch usage data
      let usageData = { daily: [], monthly: [], byModel: [] };
      try {
        const usageDaily = await fetch(`${API_BASE}/usage/daily`).then(r => r.ok ? r.json() : []);
        const usageMonthly = await fetch(`${API_BASE}/usage/monthly`).then(r => r.ok ? r.json() : []);
        const usageByModel = await fetch(`${API_BASE}/usage/by-model`).then(r => r.ok ? r.json() : []);
        usageData = { daily: usageDaily, monthly: usageMonthly, byModel: usageByModel };
      } catch {
        // Usage data might not be available
      }

      // Build comprehensive export object
      const exportObj = {
        exported_at: new Date().toISOString(),
        app_version: '1.0.0',
        summary: {
          total_conversations: conversationsWithMessages.length,
          total_messages: conversationsWithMessages.reduce((sum, c) => sum + c.messages.length, 0),
          total_projects: allProjects.length,
        },
        conversations: conversationsWithMessages.map(c => ({
          id: c.id,
          title: c.title,
          model: c.model,
          created_at: c.created_at,
          updated_at: c.updated_at,
          is_archived: c.is_archived,
          is_pinned: c.is_pinned,
          is_favorited: c.is_favorited,
          messages: c.messages.map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
            tokens: m.tokens,
          })),
        })),
        projects: allProjects.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          created_at: p.created_at,
          updated_at: p.updated_at,
        })),
        usage: usageData,
      };

      // Format as JSON
      const jsonData = JSON.stringify(exportObj, null, 2);
      setBatchExportData(jsonData);
      setBatchExportFormat('json');

    } catch (error) {
      console.error('Failed to export all data:', error);
      setShowBatchExportModal(false);
      showToast('Failed to export data', 'error');
    }
  };

  // Print conversation
  const printConversation = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const conversationTitle = currentConversation?.title || 'Claude Clone Conversation';
    const printDate = new Date().toLocaleString();

    // Build print content
    let html = `
<!DOCTYPE html>
<html>
<head>
  <title>${conversationTitle}</title>
  <style>
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #1a1a1a;
      line-height: 1.6;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #e5e5e5; }
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
    .message { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid #e5e5e5; }
    @media (prefers-color-scheme: dark) {
      .message { border-color: #404040; }
    }
    .role { font-weight: 600; margin-bottom: 8px; }
    .role.user { color: #CC785C; }
    .role.assistant { color: #2563eb; }
    .content { white-space: pre-wrap; word-wrap: break-word; }
    .content pre {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
    }
    @media (prefers-color-scheme: dark) {
      .content pre { background: #2a2a2a; }
    }
    @media print {
      body { padding: 0; }
      .message { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${conversationTitle}</h1>
  <p class="meta">Printed on ${printDate} | Model: ${currentConversation?.model || 'claude-sonnet-4-5-20250929'}</p>
`;

    messages.forEach(msg => {
      const roleClass = msg.role === 'user' ? 'user' : 'assistant';
      const roleLabel = msg.role === 'user' ? 'User' : 'Assistant';
      html += `
  <div class="message">
    <div class="role ${roleClass}">${roleLabel}</div>
    <div class="content">${escapeHtml(msg.content || '')}</div>
  </div>
`;
    });

    html += '</body></html>';

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Escape HTML helper
  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

  // Load saved prompts from library
  const loadSavedPrompts = async () => {
    try {
      const response = await fetch(`${API_BASE}/prompts/library`);
      if (response.ok) {
        const data = await response.json();
        setSavedPrompts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to load saved prompts:', error);
    }
  };

  // Save prompt to library
  const savePromptToLibrary = async () => {
    if (!promptTitle.trim() || !input.trim()) return;
    try {
      const response = await fetch(`${API_BASE}/prompts/library`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: promptTitle.trim(),
          description: promptDescription.trim(),
          prompt_template: input.trim(),
          category: promptCategory,
        }),
      });
      if (response.ok) {
        const newPrompt = await response.json();
        setSavedPrompts(prev => [newPrompt, ...prev]);
        setShowSavePromptModal(false);
        setPromptTitle('');
        setPromptDescription('');
        setPromptCategory('General');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
    }
  };

  // Delete prompt from library
  const deletePromptFromLibrary = async (promptId) => {
    try {
      const response = await fetch(`${API_BASE}/prompts/library/${promptId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSavedPrompts(prev => prev.filter(p => p.id !== promptId));
      }
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  };

  // Update prompt in library
  const updatePromptInLibrary = async (promptId, updates) => {
    try {
      const response = await fetch(`${API_BASE}/prompts/library/${promptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (response.ok) {
        const updatedPrompt = await response.json();
        setSavedPrompts(prev => prev.map(p => p.id === promptId ? updatedPrompt : p));
      }
    } catch (error) {
      console.error('Failed to update prompt:', error);
    }
  };

  // Handle logout - clears session and resets app state
  const handleLogout = async () => {
    try {
      // Call logout API endpoint (if exists)
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch (error) {
      // Ignore errors - continue with local logout
    }
    // Clear all local state
    setConversations([]);
    setCurrentConversation(null);
    setMessages([]);
    setInput('');
    setShowUserProfile(false);
    setFolders([]);
    setSavedPrompts([]);
    // Clear both localStorage and sessionStorage login state
    localStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('isLoggedIn');
    // Show login page
    setShowLoginPage(true);
  };

  // Handle successful login
  const handleLogin = (userData) => {
    setUserProfile({ name: userData.name || userData.email?.split('@')[0] || 'User', email: userData.email, avatar: userData.avatar });
    setShowLoginPage(false);
    // Login state is set in LoginPage based on remember me preference
    localStorage.setItem('userProfile', JSON.stringify({ name: userData.name, email: userData.email, avatar: userData.avatar }));
  };

  // Open prompt library modal
  const openPromptLibrary = () => {
    loadSavedPrompts();
    setShowPromptLibrary(true);
  };

  // Voice recording (mock) - simulates voice input with mock transcript
  const toggleVoiceRecording = () => {
    if (isRecordingVoice) {
      // Stop recording - insert mock transcript
      setIsRecordingVoice(false);
      // Insert mock transcript into input
      const mockTranscripts = [
        "How do I create a React component?",
        "What is the difference between useEffect and useLayoutEffect?",
        "Can you explain closures in JavaScript?",
        "How do I center a div in CSS?",
        "What are the best practices for REST API design?",
        "Explain async/await in JavaScript",
        "How do I use useState properly in React?",
        "What is the difference between null and undefined?"
      ];
      const randomTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
      setInput(prev => prev ? prev + ' ' + randomTranscript : randomTranscript);
    } else {
      // Start recording
      setIsRecordingVoice(true);
    }
  };

  // Image upload handling
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB limit
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    let hasInvalidFiles = false;
    let hasOversizedFiles = false;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        hasInvalidFiles = true;
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        hasOversizedFiles = true;
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImages(prev => [...prev, {
          id: generateId(),
          data: event.target.result, // Base64 data
          name: file.name,
          type: file.type,
          size: file.size
        }]);
        showToast(`Image "${file.name}" uploaded successfully`, 'success');
      };
      reader.readAsDataURL(file);
    });

    if (hasInvalidFiles) {
      showToast('Only image files are allowed (PNG, JPG, GIF, WebP, etc.)', 'error');
    }
    if (hasOversizedFiles) {
      showToast('Image size exceeds 10MB limit', 'error');
    }
    // Reset the file input
    e.target.value = '';
  };

  // Handle paste from clipboard (for images)
  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            setUploadedImages(prev => [...prev, {
              id: generateId(),
              data: event.target.result, // Base64 data
              name: `pasted-image-${Date.now()}.${file.type.split('/')[1]}`,
              type: file.type
            }]);
            // Show visual feedback
            if (soundPlayer) soundPlayer.playReceive();
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  // Drag and drop handlers for file upload
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (e.target.closest && !e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    let hasInvalidFiles = false;
    let hasOversizedFiles = false;

    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        hasInvalidFiles = true;
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        hasOversizedFiles = true;
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImages(prev => [...prev, {
          id: generateId(),
          data: event.target.result, // Base64 data
          name: file.name,
          type: file.type,
          size: file.size
        }]);
        showToast(`Image "${file.name}" uploaded successfully`, 'success');
      };
      reader.readAsDataURL(file);
    });

    if (hasInvalidFiles) {
      showToast('Only image files are allowed (PNG, JPG, GIF, WebP, etc.)', 'error');
    }
    if (hasOversizedFiles) {
      showToast('Image size exceeds 10MB limit', 'error');
    }
  };

  // Remove uploaded image
  const removeUploadedImage = (imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Generate response suggestions based on conversation context
  const generateSuggestions = () => {
    const lastMessage = messages[messages.length - 1];
    const userMessage = messages[messages.length - 2];
    if (!lastMessage || lastMessage.role !== 'assistant') {
      return [];
    }

    const content = lastMessage.content?.toLowerCase() || '';
    const suggestions = [];

    // Context-aware suggestions based on message content
    if (content.includes('code') || content.includes('function') || content.includes('react')) {
      suggestions.push(
        "Can you show me a code example?",
        "Explain this code step by step",
        "How can I optimize this code?"
      );
    } else if (content.includes('error') || content.includes('bug') || content.includes('issue')) {
      suggestions.push(
        "How do I fix this error?",
        "What's causing this problem?",
        "Can you suggest a workaround?"
      );
    } else if (content.includes('explain') || content.includes('what is') || content.includes('how do')) {
      suggestions.push(
        "Give me a simpler explanation",
        "Can you provide an example?",
        "What are the pros and cons?"
      );
    } else if (content.includes('help') || content.includes('create') || content.includes('build')) {
      suggestions.push(
        "Can you help me get started?",
        "What are the best practices?",
        "Show me a complete example"
      );
    } else {
      // Default suggestions
      suggestions.push(
        "Can you elaborate on that?",
        "What are the next steps?",
        "Can you provide more details?"
      );
    }

    return suggestions.slice(0, 3);
  };

  // Create folder
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          description: selectedTemplate?.description || '',
          custom_instructions: selectedTemplate?.customInstructions || ''
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const folder = data.project || data;
        setFolders(prev => [...prev, folder]);
        setNewFolderName('');
        setSelectedTemplate(null);
        setShowTemplates(false);
        setShowFolderModal(false);
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  // Open edit folder modal
  const openEditFolderModal = (folder) => {
    setIsEditingFolder(true);
    setEditingFolderId(folder.id);
    setNewFolderName(folder.name || '');
    setNewFolderDescription(folder.description || '');
    setNewFolderColor(folder.color || '#CC785C');
    setSelectedTemplate(null);
    setShowTemplates(false);
    setFolderTab('details');
    setFolderAnalytics(null);
    setKnowledgeBaseFiles([]);
    setShowFolderModal(true);

    // Fetch project analytics
    fetch(`${API_BASE}/projects/${folder.id}/analytics`)
      .then(res => res.json())
      .then(data => setFolderAnalytics(data))
      .catch(err => console.error('Error fetching project analytics:', err));

    // Fetch knowledge base files
    setKnowledgeBaseLoading(true);
    fetch(`${API_BASE}/projects/${folder.id}/knowledge`)
      .then(res => res.json())
      .then(data => setKnowledgeBaseFiles(data.files || []))
      .catch(err => console.error('Error fetching knowledge base files:', err))
      .finally(() => setKnowledgeBaseLoading(false));
  };

  // Update folder (edit mode)
  const updateFolder = async () => {
    if (!newFolderName.trim() || !editingFolderId) return;
    try {
      const response = await fetch(`${API_BASE}/projects/${editingFolderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFolderName.trim(),
          description: newFolderDescription.trim(),
          color: newFolderColor
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const updatedFolder = data.project || data;
        setFolders(prev => prev.map(f => f.id === editingFolderId ? { ...f, ...updatedFolder } : f));
        setNewFolderName('');
        setNewFolderDescription('');
        setNewFolderColor('#CC785C');
        setSelectedTemplate(null);
        setIsEditingFolder(false);
        setEditingFolderId(null);
        setShowFolderModal(false);
      }
    } catch (error) {
      console.error('Failed to update folder:', error);
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

  // Select conversation - also updates URL
  const selectConversation = async (conversation) => {
    // Close preview if open
    handlePreviewLeave();
    // Update URL to reflect current conversation
    const newUrl = `/conversation/${conversation.id}`;
    window.history.pushState({ conversationId: conversation.id }, '', newUrl);
    // Update document title
    document.title = conversation.title ? `${conversation.title} - Claude` : 'New Chat - Claude';

    setCurrentConversation(conversation);
    try {
      // Fetch full conversation data to get system_prompt
      const convResponse = await fetch(`${API_BASE}/conversations/${conversation.id}`);
      if (convResponse.ok) {
        const convData = await convResponse.json();
        // Set the conversation's system prompt if it exists
        if (convData.system_prompt !== undefined) {
          setSystemPrompt(convData.system_prompt || '');
        }
      }

      const response = await fetch(`${API_BASE}/conversations/${conversation.id}/messages`);
      if (response.ok) {
        const data = await response.json();
        // Backend returns array directly, not wrapped in { messages: [...] }
        setMessages(Array.isArray(data) ? data : (data.messages || []));
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  // Handle conversation preview hover
  const handlePreviewHover = useCallback(async (conversationId, title, rect) => {
    // Clear any existing timeout
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Set preview state immediately for positioning
    setPreviewConversationId(conversationId);
    setPreviewConversationTitle(title);
    setPreviewPosition(rect);
    setPreviewMessages([]);
    setHoverPreviewLoading(true);

    // Add a small delay before fetching to prevent fetching on quick mouse movements
    previewTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`);
        if (response.ok) {
          const data = await response.json();
          const msgs = Array.isArray(data) ? data : (data.messages || []);
          setPreviewMessages(msgs);
        }
      } catch (error) {
        console.error('Failed to load preview messages:', error);
      } finally {
        setHoverPreviewLoading(false);
      }
    }, 200); // 200ms delay before fetching
  }, []);

  // Handle conversation preview leave
  const handlePreviewLeave = useCallback(() => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }
    setPreviewConversationId(null);
    setPreviewPosition(null);
    setPreviewMessages([]);
    setHoverPreviewLoading(false);
  }, []);

  // Save conversation-specific system prompt to backend
  const saveConversationSystemPrompt = async (prompt) => {
    if (!currentConversation?.id) return;
    try {
      await fetch(`${API_BASE}/conversations/${currentConversation.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system_prompt: prompt })
      });
    } catch (error) {
      console.error('Failed to save system prompt:', error);
    }
  };

  // Handle system prompt change with debounce to save to backend
  const handleSystemPromptChange = (newPrompt) => {
    setSystemPrompt(newPrompt);
    // Save to backend with a small delay to avoid too many requests
    clearTimeout(window.systemPromptSaveTimeout);
    window.systemPromptSaveTimeout = setTimeout(() => {
      saveConversationSystemPrompt(newPrompt);
    }, 500);
  };

  // Detect artifacts from message content
  // Artifacts are typically code blocks with specific language tags that indicate
  // they should be rendered as standalone artifacts
  const detectArtifacts = (content) => {
    const artifacts = [];

    // Pattern to match artifact code blocks
    // Format: ```artifact-type or ```language:artifact-identifier
    const artifactBlockRegex = /```(?:(\w+):)?(?:artifact-)?identifier\s*([^\n]*)\n([\s\S]*?)```/g;

    let match;
    while ((match = artifactBlockRegex.exec(content)) !== null) {
      const [, language, identifier, code] = match;
      const artifactLanguage = language || identifier || 'text';
      const artifactIdentifier = identifier || '';

      // Create artifact object
      const artifact = {
        id: generateId(),
        type: getArtifactType(artifactLanguage),
        language: artifactLanguage,
        identifier: artifactIdentifier.trim(),
        title: generateArtifactTitle(artifactLanguage, artifactIdentifier),
        content: code.trim(),
        createdAt: Date.now()
      };

      artifacts.push(artifact);
    }

    // Also check for common patterns that indicate artifacts
    // HTML files
    const htmlRegex = /```html\s*\n([\s\S]*?)```/g;
    while ((match = htmlRegex.exec(content)) !== null) {
      // Check if it's not already detected as an artifact
      if (!artifacts.some(a => a.content === match[1].trim())) {
        artifacts.push({
          id: generateId(),
          type: 'html',
          language: 'html',
          identifier: '',
          title: 'HTML Document',
          content: match[1].trim(),
          createdAt: Date.now()
        });
      }
    }

    // SVG files
    const svgRegex = /```svg\s*\n([\s\S]*?)```/g;
    while ((match = svgRegex.exec(content)) !== null) {
      if (!artifacts.some(a => a.content === match[1].trim())) {
        artifacts.push({
          id: generateId(),
          type: 'svg',
          language: 'svg',
          identifier: '',
          title: 'SVG Graphic',
          content: match[1].trim(),
          createdAt: Date.now()
        });
      }
    }

    // React components
    const reactRegex = /```react(?:\s+identifier\s+(\S+))?\s*\n([\s\S]*?)```/g;
    while ((match = reactRegex.exec(content)) !== null) {
      if (!artifacts.some(a => a.content === match[2].trim())) {
        artifacts.push({
          id: generateId(),
          type: 'react',
          language: 'jsx',
          identifier: match[1] || '',
          title: match[1] ? `${match[1]} Component` : 'React Component',
          content: match[2].trim(),
          createdAt: Date.now()
        });
      }
    }

    // Mermaid diagrams
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
    while ((match = mermaidRegex.exec(content)) !== null) {
      if (!artifacts.some(a => a.content === match[1].trim())) {
        artifacts.push({
          id: generateId(),
          type: 'mermaid',
          language: 'mermaid',
          identifier: '',
          title: 'Mermaid Diagram',
          content: match[1].trim(),
          createdAt: Date.now()
        });
      }
    }

    return artifacts;
  };

  // Determine artifact type from language
  const getArtifactType = (language) => {
    const htmlLanguages = ['html', 'htm'];
    const svgLanguages = ['svg'];
    const reactLanguages = ['react', 'jsx', 'tsx'];
    const mermaidLanguages = ['mermaid'];
    const codeLanguages = ['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'css', 'json', 'bash', 'sh', 'sql', 'java', 'c', 'cpp', 'go', 'rust', 'ruby', 'php'];

    if (htmlLanguages.includes(language.toLowerCase())) return 'html';
    if (svgLanguages.includes(language.toLowerCase())) return 'svg';
    if (reactLanguages.includes(language.toLowerCase())) return 'react';
    if (mermaidLanguages.includes(language.toLowerCase())) return 'mermaid';

    return 'code';
  };

  // Generate a human-readable title for artifacts
  const generateArtifactTitle = (language, identifier) => {
    const titles = {
      html: 'HTML Document',
      svg: 'SVG Graphic',
      react: identifier ? `${identifier} Component` : 'React Component',
      jsx: identifier ? `${identifier} Component` : 'React Component',
      tsx: identifier ? `${identifier} Component` : 'React Component',
      mermaid: 'Mermaid Diagram',
      javascript: 'JavaScript Code',
      js: 'JavaScript Code',
      typescript: 'TypeScript Code',
      ts: 'TypeScript Code',
      python: 'Python Code',
      py: 'Python Code',
      css: 'CSS Styles',
      json: 'JSON Data',
      bash: 'Shell Script',
      sh: 'Shell Script',
      sql: 'SQL Query',
      java: 'Java Code',
      c: 'C Code',
      cpp: 'C++ Code',
      go: 'Go Code',
      rust: 'Rust Code',
      ruby: 'Ruby Code',
      php: 'PHP Code',
      text: 'Text Document'
    };

    return titles[language.toLowerCase()] || `${language} Code`;
  };

  // Rich text formatting functions
  const applyBold = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);

    // If there's selected text, wrap it with **
    if (selectedText) {
      const newText = input.substring(0, start) + '**' + selectedText + '**' + input.substring(end);
      setInput(newText);
      // Set cursor position after the formatting
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, end + 2);
      }, 0);
    } else {
      // No selection, insert ** at cursor and place cursor between them
      const newText = input.substring(0, start) + '****' + input.substring(end);
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  const applyItalic = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);

    // If there's selected text, wrap it with *
    if (selectedText) {
      const newText = input.substring(0, start) + '*' + selectedText + '*' + input.substring(end);
      setInput(newText);
      // Set cursor position after the formatting
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, end + 1);
      }, 0);
    } else {
      // No selection, insert * at cursor and place cursor between them
      const newText = input.substring(0, start) + '**' + input.substring(end);
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
  };

  const applyStrikethrough = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);

    // If there's selected text, wrap it with ~~
    if (selectedText) {
      const newText = input.substring(0, start) + '~~' + selectedText + '~~' + input.substring(end);
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, end + 2);
      }, 0);
    } else {
      const newText = input.substring(0, start) + '~~~~' + input.substring(end);
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 2, start + 2);
      }, 0);
    }
  };

  const applyCode = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);

    // If there's selected text, wrap it with `
    if (selectedText) {
      const newText = input.substring(0, start) + '`' + selectedText + '`' + input.substring(end);
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, end + 1);
      }, 0);
    } else {
      const newText = input.substring(0, start) + '``' + input.substring(end);
      setInput(newText);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 1);
      }, 0);
    }
  };

  const applyLink = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);

    // Use selected text as link text, or placeholder
    const linkText = selectedText || 'link text';
    const newText = input.substring(0, start) + '[' + linkText + '](url)' + input.substring(end);
    setInput(newText);
    setTimeout(() => {
      textarea.focus();
      // Select "url" so user can replace it easily
      const urlStart = start + linkText.length + 3;
      textarea.setSelectionRange(urlStart, urlStart + 3);
    }, 0);
  };

  const applyBulletList = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = input.substring(start, end);

    // Add bullet point at the beginning of line
    const beforeCursor = input.substring(0, start);
    const afterCursor = input.substring(end);

    // Find the start of the current line
    let lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineStartText = input.substring(lineStart, start);
    const indent = lineStartText.match(/^\s*/)[0];

    const newText = input.substring(0, lineStart) + indent + '- ' + input.substring(lineStart);
    setInput(newText);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = lineStart + indent.length + 2;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const applyNumberedList = () => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Find the start of the current line
    const beforeCursor = input.substring(0, start);
    let lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineStartText = input.substring(lineStart, start);
    const indent = lineStartText.match(/^\s*/)[0];

    const newText = input.substring(0, lineStart) + indent + '1. ' + input.substring(lineStart);
    setInput(newText);
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = lineStart + indent.length + 3;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Send message
  const sendMessage = async () => {
    try {
      console.log('sendMessage: Starting');
      // Allow sending with images even if input is empty
      if ((!input.trim() && uploadedImages.length === 0) || isLoading) {
        console.log('sendMessage: Early return');
        return;
      }

      // Clear response suggestions when starting a new message
      setResponseSuggestions([]);

      // Store images to include in message and clear state
      const currentImages = [...uploadedImages];
      setUploadedImages([]);

      const userMessage = {
        id: generateId(),
        role: 'user',
        content: input.trim(),
        images: currentImages, // Include images in message
        created_at: new Date().toISOString(),
      };
      console.log('sendMessage: userMessage created');

      // Create conversation if needed
      let conversationId = currentConversation?.id;
      console.log('sendMessage: conversationId before check:', conversationId);
      if (!conversationId) {
        console.log('sendMessage: Creating conversation');
        await createConversation();
        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        conversationId = currentConversation?.id;
        console.log('sendMessage: conversationId after create:', conversationId);
      }

      console.log('sendMessage: Updating state');
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);
      setIsStreaming(true);

      // Play send sound
      soundPlayer.playSend();

      // Set up undo message (5 second window)
      setUndoMessage(userMessage);
      const timer = setTimeout(() => {
        setUndoMessage(null);
        setUndoTimeout(null);
      }, 5000);
      setUndoTimeout(timer);

      // Create abort controller for this request
      const requestController = new AbortController();
      setAbortController(requestController);

      // Add streaming message placeholder
      const assistantMessageId = generateId();
      console.log('sendMessage: Adding placeholder');
      // Record response start time for timing display
      const responseStartTime = Date.now();
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        isStreaming: true,
        created_at: new Date().toISOString(),
        inputTokens: 0,
        outputTokens: 0,
      }]);

      console.log('sendMessage: Fetching response');

      let responseText = '';
      let useStreaming = true;

      try {
        // Try streaming endpoint first
        console.log('sendMessage: Trying streaming endpoint...');
        const timeoutId = setTimeout(() => {
          console.log('sendMessage: Request timeout - aborting');
          requestController.abort();
        }, 60000);

        let response;
        try {
          response = await fetch(`${API_BASE}/messages/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversation_id: conversationId,
              content: userMessage.content,
              images: currentImages, // Include uploaded images
              model: selectedModel,
              temperature: temperature,
              top_p: topP,
              max_tokens: maxTokens,
              thinking_enabled: thinkingEnabled,
              system_prompt: systemPrompt || undefined,
            }),
            signal: requestController.signal,
          });
          clearTimeout(timeoutId);
          console.log('sendMessage: Streaming response received', response.status);
        } catch (err) {
          clearTimeout(timeoutId);
          console.log('sendMessage: Streaming fetch error:', err.name, err.message);
          useStreaming = false;
        }

        if (useStreaming && response && response.ok) {
          console.log('sendMessage: Reading stream');
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let tokenUsage = { inputTokens: 0, outputTokens: 0 };
          let thinkingContent = '';

          while (true) {
            try {
              const { done, value } = await reader.read();
              if (done) break;

              let chunk = decoder.decode(value);

              // Check for thinking content marker
              const thinkingMatch = chunk.match(/\[TABLET_THINKING:(\{[^}]+\})\]/);
              if (thinkingMatch) {
                try {
                  const thinkingData = JSON.parse(thinkingMatch[1]);
                  thinkingContent = thinkingData.thinking || '';
                  // Remove the thinking marker from the displayed text
                  chunk = chunk.replace(/\[TABLET_THINKING:\{[^}]+\}\]/, '');
                } catch (e) {
                  console.log('Failed to parse thinking:', e);
                }
              }

              // Check for token usage marker at the end
              const tokenUsageMatch = chunk.match(/\[TABLET_TOKEN_USAGE:(\{[^}]+\})\]/);
              if (tokenUsageMatch) {
                try {
                  tokenUsage = JSON.parse(tokenUsageMatch[1]);
                  // Remove the token usage marker from the displayed text
                  responseText = responseText.replace(/\[TABLET_TOKEN_USAGE:\{[^}]+\}\]$/, '');
                  chunk = chunk.replace(/\[TABLET_TOKEN_USAGE:\{[^}]+\}\]/, '');
                } catch (e) {
                  console.log('Failed to parse token usage:', e);
                }
              } else {
                responseText += chunk;
              }

              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: responseText, thinking: thinkingContent, inputTokens: tokenUsage.inputTokens, outputTokens: tokenUsage.outputTokens }
                  : msg
              ));
            } catch (readError) {
              console.log('Stream read error:', readError);
              break;
            }
          }
        } else {
          // Fall back to non-streaming endpoint
          console.log('sendMessage: Falling back to non-streaming endpoint...');
          const chatResponse = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: userMessage.content,
              images: currentImages, // Include uploaded images
              model: selectedModel,
              temperature: temperature,
              top_p: topP,
              max_tokens: maxTokens,
              system_prompt: systemPrompt || undefined,
            }),
          });

          if (chatResponse.ok) {
            const data = await chatResponse.json();
            responseText = data.response || '';
            // Store token usage from non-streaming response
            const tokenUsage = { inputTokens: data.inputTokens || 0, outputTokens: data.outputTokens || 0 };
            console.log('sendMessage: Non-streaming response:', responseText.substring(0, 100));
            console.log('sendMessage: Token usage:', tokenUsage);
            // Update message with token usage
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, inputTokens: tokenUsage.inputTokens, outputTokens: tokenUsage.outputTokens }
                : msg
            ));
          } else {
            throw new Error('Non-streaming endpoint also failed');
          }
        }
      } catch (error) {
        console.log('sendMessage: All endpoints failed');
        throw error;
      }

      // Mark streaming complete and update with final response
      console.log('sendMessage: Complete with response:', responseText.substring(0, 50));
      // Calculate response time
      const responseTimeMs = Date.now() - responseStartTime;
      const responseTimeSec = (responseTimeMs / 1000).toFixed(1);
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: responseText, isStreaming: false, responseTime: responseTimeSec }
          : msg
      ));

      // Play receive sound when response is complete
      soundPlayer.playReceive();

      // Detect and extract artifacts from the response
      const detectedArtifacts = detectArtifacts(responseText);
      if (detectedArtifacts.length > 0) {
        setArtifacts(prev => {
          const newArtifacts = [...prev, ...detectedArtifacts];
          // Auto-open the artifact panel if there's an artifact
          if (newArtifacts.length > 0 && !isArtifactPanelOpen) {
            setIsArtifactPanelOpen(true);
            setActiveArtifact(newArtifacts[newArtifacts.length - 1]);
          }
          return newArtifacts;
        });
        // Update artifact versions
        detectedArtifacts.forEach(artifact => {
          setArtifactVersions(prev => ({
            ...prev,
            [artifact.id]: [{ content: artifact.content, timestamp: Date.now() }]
          }));
        });
      }

      // Update conversation title if it's the first message
      if (messages.length === 0) {
        loadConversations();
      }

    } catch (error) {
      console.error('sendMessage error:', error);
      // Play error sound
      soundPlayer.playError();
      if (error.name === 'AbortError') {
        console.log('Request aborted');
      } else {
        // Check if it's a network error
        const isNetworkError = !navigator.onLine ||
          error.message.includes('network') ||
          error.message.includes('fetch') ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('TypeError: Failed') ||
          error.status === 0 ||
          error.status === 503;

        if (isNetworkError) {
          console.log('Network error detected');
          setNetworkError('Network error: Unable to connect to the server. Please check your connection.');
          setShowNetworkBanner(true);
          showToast('Network error - Please check your connection', 'error');

          // Update message with network error indicator and store for retry
          setMessages(prev => {
            if (!prev || !Array.isArray(prev)) return prev;
            // Find last user message before error
            const lastUserMsg = [...prev].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
              setLastFailedMessage(lastUserMsg);
            }
            return prev.map(msg =>
              msg.isStreaming
                ? { ...msg, content: (msg.content || '') + '\n[Network Error: Connection failed. Please retry when connected.]', isStreaming: false, hasError: true }
                : msg
            );
          });
        } else {
          // Safe state update with fallback for other errors
          setMessages(prev => {
            if (!prev || !Array.isArray(prev)) return prev;
            // Find last user message before error
            const lastUserMsg = [...prev].reverse().find(m => m.role === 'user');
            if (lastUserMsg) {
              setLastFailedMessage(lastUserMsg);
            }
            return prev.map(msg =>
              msg.isStreaming
                ? { ...msg, content: (msg.content || '') + '\n[Error: Failed to get response]', hasError: true }
                : msg
            );
          });
        }
      }
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
      setAbortController(null);
      // Generate response suggestions when streaming completes
      setResponseSuggestions(generateSuggestions());
    }
  };

  // Retry last failed message
  const retryLastMessage = async () => {
    if (!lastFailedMessage) return;

    // Remove the failed error message from messages
    setMessages(prev => {
      if (!prev || !Array.isArray(prev)) return prev;
      // Remove messages with hasError from the end until we find a user message
      const newMessages = [...prev];
      while (newMessages.length > 0) {
        const lastMsg = newMessages[newMessages.length - 1];
        if (lastMsg.hasError) {
          newMessages.pop();
        } else if (lastMsg.role === 'user') {
          // Don't remove the user message, just the error after it
          break;
        } else {
          break;
        }
      }
      return newMessages;
    });

    // Store the message content and retry
    const contentToRetry = lastFailedMessage.content;
    const imagesToRetry = lastFailedMessage.images || [];
    setLastFailedMessage(null);
    setShowNetworkBanner(false);
    setNetworkError(null);

    // Set input and call sendMessage
    setInput(contentToRetry);
    if (imagesToRetry.length > 0) {
      setCurrentImages(imagesToRetry);
    }

    // Use sendMessage logic to resend
    await sendMessage({ preventDefault: () => {} }, contentToRetry, imagesToRetry);
  };

  // Stop generation
  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
    }
  };

  // Save edited artifact
  const saveEditedArtifact = () => {
    if (!editingArtifact || !activeArtifact) return;

    // Update the artifact content
    setArtifacts(prev => prev.map(a =>
      a.id === activeArtifact.id
        ? { ...a, content: editingArtifact.content }
        : a
    ));

    // Update the active artifact
    setActiveArtifact(prev => ({
      ...prev,
      content: editingArtifact.content
    }));

    // Add new version to history
    setArtifactVersions(prev => ({
      ...prev,
      [activeArtifact.id]: [
        ...(prev[activeArtifact.id] || []),
        { content: editingArtifact.content, timestamp: Date.now() }
      ]
    }));

    setEditingArtifact(null);
  };

  // Delete artifact
  const deleteArtifact = (artifactId) => {
    setArtifacts(prev => prev.filter(a => a.id !== artifactId));
    if (activeArtifact?.id === artifactId) {
      const remaining = artifacts.filter(a => a.id !== artifactId);
      setActiveArtifact(remaining.length > 0 ? remaining[remaining.length - 1] : null);
      if (remaining.length === 0) {
        setIsArtifactPanelOpen(false);
      }
    }
  };

  // Handle keyboard input
  const handleKeyDown = (e) => {
    // Slash command menu navigation
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashCommandIndex(prev => Math.min(prev + 1, filteredSlashCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashCommandIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSlashCommands[slashCommandIndex]) {
          filteredSlashCommands[slashCommandIndex].action();
          setShowSlashMenu(false);
          setSlashFilter('');
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        setSlashFilter('');
        setInput(prev => prev.replace(/^\/[^\s]*\s*/, ''));
        return;
      }
    }
    // Mention menu navigation
    if (showMentionMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, filteredMentions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filteredMentions[mentionIndex]) {
          // Replace @filter with @label in input
          const mention = filteredMentions[mentionIndex];
          setInput(prev => prev.replace(/@\S*$/, `@${mention.label} `));
          setShowMentionMenu(false);
          setMentionFilter('');
          inputRef.current?.focus();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionMenu(false);
        setMentionFilter('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Filter conversations by search and archived status
  let filteredConversations = conversations.filter(c =>
    (showFavorites ? c.is_favorited : (showArchived ? c.is_archived : !c.is_archived)) &&
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (!filterProject || c.project_id === filterProject || (c.project_id === null && filterProject === 'none')) &&
    (!filterModel || c.model === filterModel)
  );

  // Sort conversations based on selected option
  filteredConversations = [...filteredConversations].sort((a, b) => {
    // Pinned conversations always come first (unless sorting alphabetically)
    if (conversationSort !== 'alphabetical') {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
    }

    const dateA = new Date(a.updated_at || a.created_at);
    const dateB = new Date(b.updated_at || b.created_at);

    switch (conversationSort) {
      case 'oldest':
        return dateA.getTime() - dateB.getTime();
      case 'newest':
        return dateB.getTime() - dateA.getTime();
      case 'alphabetical':
        return (a.title || '').localeCompare(b.title || '');
      default:
        return dateB.getTime() - dateA.getTime(); // Default to newest
    }
  });

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
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                      >{msg.content}</ReactMarkdown>
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

  // Show login page if not logged in
  if (showLoginPage) {
    return <LoginPage onLogin={handleLogin} onNavigateToRegister={() => {}} theme={theme} />;
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* Skip to main content link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div
        className={`h-screen flex ${highContrast ? 'bg-white text-black' : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'}`}
        style={reducedMotion ? { '--tw-transition-duration': '0ms', transitionDuration: '0ms' } : {}}
        id="main-content"
        tabIndex={-1}
      >
        {/* Sidebar - Hidden in focus mode */}
        {!focusMode && (
        <div style={{ width: sidebarOpen ? sidebarWidth : 0 }} className={`flex-shrink-0 ${highContrast ? 'bg-gray-100 border-black' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'} border-r transition-all duration-300 overflow-hidden ${reducedMotion ? '!transition-none' : ''}`}>
          <div className="p-4 flex flex-col h-full">
            {/* New Chat Button */}
            <button
              onClick={createConversation}
              className={`flex items-center gap-2 w-full px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium ${highContrast ? 'ring-2 ring-black' : ''}`}
              aria-label="Start new chat"
              title="Start a new conversation"
            >
              <Icons.Plus />
              New Chat
            </button>

            {/* New Folder Button */}
            <button
              onClick={() => setShowFolderModal(true)}
              className={`mt-2 flex items-center gap-2 w-full px-4 py-2 ${highContrast ? 'bg-gray-300 hover:bg-gray-400 text-black border-2 border-black' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'} rounded-lg transition-colors text-sm`}
              aria-label="Create new folder"
              title="Create a new folder for organizing conversations"
            >
              <Icons.Folder />
              New Folder
            </button>

            {/* Search */}
            <div className="mt-4 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
                <Icons.Search />
              </span>
              <label htmlFor="conversation-search" className="sr-only">Search conversations</label>
              <input
                id="conversation-search"
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${highContrast ? 'bg-white border-2 border-black text-black' : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600'}`}
                aria-label="Search conversations"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="mt-2 flex gap-2">
              <label htmlFor="filter-project" className="sr-only">Filter by project</label>
              <select
                id="filter-project"
                value={filterProject}
                onChange={e => setFilterProject(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Filter by project"
              >
                <option value="">All Projects</option>
                <option value="none">No Project</option>
                {folders.map(folder => (
                  <option key={folder.id} value={folder.id}>{folder.name}</option>
                ))}
              </select>
              <label htmlFor="filter-model" className="sr-only">Filter by model</label>
              <select
                id="filter-model"
                value={filterModel}
                onChange={e => setFilterModel(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Filter by model"
              >
                <option value="">All Models</option>
                {MODELS.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="sort-conversations" className="sr-only">Sort by</label>
              <select
                id="sort-conversations"
                value={conversationSort}
                onChange={e => setConversationSort(e.target.value)}
                className="px-2 py-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                aria-label="Sort conversations"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
              <span className="text-xs text-gray-500 dark:text-gray-400">Sort</span>
            </div>

            {/* Bulk Actions Toolbar */}
            {bulkSelectMode ? (
              <div className="mt-3 p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-primary-700 dark:text-primary-300">
                    {selectedConversations.length} selected
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={selectAllConversations}
                      className="px-2 py-1 text-xs rounded hover:bg-primary-100 dark:hover:bg-primary-800 text-primary-600 dark:text-primary-400"
                      title="Select all"
                    >
                      All
                    </button>
                    <button
                      onClick={deselectAllConversations}
                      className="px-2 py-1 text-xs rounded hover:bg-primary-100 dark:hover:bg-primary-800 text-primary-600 dark:text-primary-400"
                      title="Deselect all"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={bulkDeleteConversations}
                    disabled={selectedConversations.length === 0}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete selected"
                  >
                    <Icons.Trash />
                    Delete
                  </button>
                  <button
                    onClick={bulkArchiveConversations}
                    disabled={selectedConversations.length === 0}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Archive selected"
                  >
                    <Icons.Archive />
                    Archive
                  </button>
                  <button
                    onClick={bulkPinConversations}
                    disabled={selectedConversations.length === 0}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Pin selected"
                  >
                    <Icons.Pin />
                    Pin
                  </button>
                </div>
                <button
                  onClick={() => {
                    setBulkSelectMode(false);
                    setSelectedConversations([]);
                  }}
                  className="mt-2 w-full px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setBulkSelectMode(true)}
                className={`mt-2 flex items-center gap-2 w-full px-4 py-2 ${highContrast ? 'bg-gray-300 hover:bg-gray-400 text-black border-2 border-black' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'} rounded-lg transition-colors text-sm`}
                aria-label="Select multiple conversations"
                title="Select multiple conversations for bulk actions"
              >
                <Icons.CheckSquare />
                Select Multiple
              </button>
            )}

            {/* Folders Section */}
            {folders.length > 0 && (
              <div className="mt-4 flex-1 overflow-y-auto space-y-1">
                {folders.map(folder => {
                  const folderConversations = conversations.filter(c =>
                    c.project_id === folder.id && !c.is_archived
                  );
                  const isExpanded = expandedFolders.includes(folder.id);
                  return (
                    <div key={folder.id} className="mb-2 group">
                      <div
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => toggleFolder(folder.id)}
                      >
                        <span className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          <Icons.ChevronRight />
                        </span>
                        {folder.color && (
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: folder.color }}
                            title="Project color"
                          />
                        )}
                        <Icons.Folder />
                        <span className="text-sm font-medium flex-1">{folder.name}</span>
                        <span className="text-xs text-gray-500">{folderConversations.length}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditFolderModal(folder);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500 transition-opacity"
                          title="Edit project settings"
                          aria-label="Edit project settings"
                        >
                          <Icons.Settings />
                        </button>
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
                              onDuplicate={duplicateConversation}
                              onExport={exportConversation}
                              onPrint={printConversation}
                              onShare={shareConversation}
                              onToggleUnread={toggleConversationUnread}
                              onToggleFavorite={toggleConversationFavorite}
                              onMerge={initiateMerge}
                              folders={folders}
                              bulkSelectMode={bulkSelectMode}
                              isSelected={selectedConversations.includes(conv.id)}
                              onToggleSelect={toggleConversationSelection}
                              onHover={handlePreviewHover}
                              onLeave={handlePreviewLeave}
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
                      onPrint={printConversation}
                      onShare={shareConversation}
                      onToggleUnread={toggleConversationUnread}
                      onToggleFavorite={toggleConversationFavorite}
                      onMerge={initiateMerge}
                      folders={folders}
                      bulkSelectMode={bulkSelectMode}
                      isSelected={selectedConversations.includes(conv.id)}
                      onToggleSelect={toggleConversationSelection}
                      onHover={handlePreviewHover}
                      onLeave={handlePreviewLeave}
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
                      onPrint={printConversation}
                      onShare={shareConversation}
                      onToggleUnread={toggleConversationUnread}
                      onToggleFavorite={toggleConversationFavorite}
                      onMerge={initiateMerge}
                      folders={folders}
                      bulkSelectMode={bulkSelectMode}
                      isSelected={selectedConversations.includes(conv.id)}
                      onToggleSelect={toggleConversationSelection}
                      onHover={handlePreviewHover}
                      onLeave={handlePreviewLeave}
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
                      onPrint={printConversation}
                      onShare={shareConversation}
                      onToggleUnread={toggleConversationUnread}
                      onToggleFavorite={toggleConversationFavorite}
                      onMerge={initiateMerge}
                      folders={folders}
                      bulkSelectMode={bulkSelectMode}
                      isSelected={selectedConversations.includes(conv.id)}
                      onToggleSelect={toggleConversationSelection}
                      onHover={handlePreviewHover}
                      onLeave={handlePreviewLeave}
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
                      onPrint={printConversation}
                      onShare={shareConversation}
                      onToggleUnread={toggleConversationUnread}
                      onToggleFavorite={toggleConversationFavorite}
                      onMerge={initiateMerge}
                      folders={folders}
                      bulkSelectMode={bulkSelectMode}
                      isSelected={selectedConversations.includes(conv.id)}
                      onToggleSelect={toggleConversationSelection}
                      onHover={handlePreviewHover}
                      onLeave={handlePreviewLeave}
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
                      onPrint={printConversation}
                      onShare={shareConversation}
                      onToggleUnread={toggleConversationUnread}
                      onToggleFavorite={toggleConversationFavorite}
                      onMerge={initiateMerge}
                      folders={folders}
                      bulkSelectMode={bulkSelectMode}
                      isSelected={selectedConversations.includes(conv.id)}
                      onToggleSelect={toggleConversationSelection}
                      onHover={handlePreviewHover}
                      onLeave={handlePreviewLeave}
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
                      onPrint={printConversation}
                      onShare={shareConversation}
                      onToggleUnread={toggleConversationUnread}
                      onToggleFavorite={toggleConversationFavorite}
                      onMerge={initiateMerge}
                      folders={folders}
                      bulkSelectMode={bulkSelectMode}
                      isSelected={selectedConversations.includes(conv.id)}
                      onToggleSelect={toggleConversationSelection}
                      onHover={handlePreviewHover}
                      onLeave={handlePreviewLeave}
                    />
                  ))}
                </div>
              )}
              {filteredConversations.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 px-2">No conversations yet</p>
              )}
            </div>

            {/* Favorites Toggle */}
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`mt-2 flex items-center gap-2 w-full px-3 py-2 rounded-lg transition-colors text-sm ${
                showFavorites ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icons.BookmarkFilled />
              {showFavorites ? 'Showing Favorites' : 'Show Favorites'}
            </button>

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

            {/* Team Workspaces Button */}
            <button
              onClick={() => setShowWorkspaces(true)}
              className="mt-2 flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Team Workspaces
            </button>

            {/* Prompt Library Button */}
            <button
              onClick={openPromptLibrary}
              className="mt-2 flex items-center gap-2 w-full px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              <Icons.Bookmark />
              Prompt Library
            </button>

            {/* User Profile */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowUserProfile(!showUserProfile)}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                  {userProfile.avatar ? (
                    <img src={userProfile.avatar} alt={userProfile.name} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    userProfile.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{userProfile.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">View profile</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transform transition-transform ${showUserProfile ? 'rotate-180' : ''}`}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {/* Profile Options */}
              {showUserProfile && (
                <div className="mt-2 ml-3 space-y-1">
                  <button
                    onClick={() => setShowChangeEmail(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Edit Profile
                  </button>
                  <button
                    onClick={() => setShowChangePassword(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Change Password
                  </button>
                  <button
                    onClick={() => setShowTwoFactorModal(true)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                    Two-Factor Auth
                  </button>
                  <button
                    onClick={() => {
                      const confirmed = confirm('Are you sure you want to delete your account? This action cannot be undone.');
                      if (confirmed) {
                        const password = prompt('Please enter your password to confirm account deletion:');
                        if (password) {
                          alert('Account deletion is disabled in demo mode.');
                        }
                      }
                    }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    Delete Account
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Conversation Preview Popup */}
        <ConversationPreviewPopup
          conversationId={previewConversationId}
          title={previewConversationTitle}
          position={previewPosition}
          messages={previewMessages}
          isLoading={hoverPreviewLoading}
          onClose={handlePreviewLeave}
        />

        {/* Sidebar Resize Handle - Hidden in focus mode */}
        {!focusMode && sidebarOpen && (
          <div
            className="w-1 flex-shrink-0 cursor-col-resize hover:bg-primary-500/50 active:bg-primary-500 transition-colors"
            onMouseDown={() => setIsResizing(true)}
            title="Drag to resize sidebar"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
          />
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex min-w-0">
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              {/* Conversation Statistics */}
              {currentConversation && (
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" title="Message count">
                    {messages.length} {messages.length === 1 ? 'message' : 'messages'}
                  </span>
                  {currentConversation.token_count > 0 && (
                    <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" title="Token count">
                      {currentConversation.token_count.toLocaleString()} tokens
                    </span>
                  )}
                  {totalConversationCost > 0 && (
                    <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" title="Total cost">
                      {formatCost(totalConversationCost)}
                    </span>
                  )}
                  {currentConversation.created_at && (
                    <span className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded" title="Created">
                      {formatDateHelper(currentConversation.created_at, language)}
                    </span>
                  )}
                </div>
              )}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Icons.Sun /> : <Icons.Moon />}
              </button>
              {/* Focus Mode Toggle */}
              <button
                onClick={() => setFocusMode(!focusMode)}
                className={`p-2 rounded-lg transition-colors ${focusMode ? 'bg-primary-500 text-white hover:bg-primary-600' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
                title={focusMode ? 'Exit focus mode' : 'Focus mode - hide sidebar'}
              >
                {focusMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20"></polyline>
                    <polyline points="20 10 14 10 14 4"></polyline>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                )}
              </button>
            </div>
          </header>

          {/* Messages Area */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${highContrast ? 'bg-white' : ''}`}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${highContrast ? 'bg-gray-200' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <Icons.Bot />
                </div>
                <h2 className="text-xl font-semibold mb-2">Start a conversation</h2>
                <p className={`max-w-md ${highContrast ? 'text-gray-800' : 'text-gray-500 dark:text-gray-400'}`}>
                  Ask me anything - I'm here to help with coding, writing, analysis, math, and more.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {['Help me write a function', 'Explain a concept', 'Debug my code', 'Brainstorm ideas'].map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className={`px-4 py-2 text-sm rounded-full transition-colors ${highContrast ? 'bg-gray-200 hover:bg-gray-300 text-black border-2 border-black' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {(() => {
                  // Separate top-level messages from thread replies
                  const topLevelMessages = messages.filter(m => !m.parent_message_id);
                  const getThreadReplies = (parentId) => messages.filter(m => m.parent_message_id === parentId);

                  return topLevelMessages.map(message => {
                    const messageIndex = messages.indexOf(message);
                    const threadReplies = getThreadReplies(message.id);
                    const hasThread = threadReplies.length > 0;
                    const isThreadExpanded = expandedThreads.includes(message.id);

                    return (
                      <div key={message.id} className="thread-container">
                        <Message
                          message={message}
                          model={currentConversation?.model || MODELS[0].id}
                          onRegenerate={() => {}}
                          onEdit={startEditMessage}
                          isEditing={editingMessageId === message.id}
                          editedContent={editingMessageId === message.id ? editedMessageContent : ''}
                          onEditedContentChange={setEditedMessageContent}
                          onSaveEdit={saveEditedMessage}
                          onCancelEdit={cancelEditMessage}
                          onDelete={deleteMessage}
                          onBranch={branchConversation}
                          onImageClick={(imageData) => setLightboxImage(imageData)}
                          onOpenArtifact={() => {
                            if (artifacts.length > 0) {
                              setActiveArtifact(artifacts[artifacts.length - 1]);
                              setIsArtifactPanelOpen(true);
                            }
                          }}
                          hasArtifact={artifacts.length > 0 && message.role === 'assistant'}
                          showThinking={thinkingEnabled && message.role === 'assistant'}
                          highContrast={highContrast}
                          language={language}
                          hasThread={hasThread}
                          threadCount={threadReplies.length}
                          isThreadExpanded={isThreadExpanded}
                          onToggleThread={() => {
                            if (isThreadExpanded) {
                              setExpandedThreads(prev => prev.filter(id => id !== message.id));
                            } else {
                              setExpandedThreads(prev => [...prev, message.id]);
                            }
                          }}
                          onMessageReferenceClick={scrollToMessage}
                          highlightedMessageId={highlightedMessageId}
                        />
                        {/* Thread replies */}
                        {hasThread && isThreadExpanded && (
                          <div className="ml-8 pl-4 border-l-2 border-gray-200 dark:border-gray-700 mt-2 space-y-3">
                            {threadReplies.map(reply => (
                              <Message
                                key={reply.id}
                                message={reply}
                                model={currentConversation?.model || MODELS[0].id}
                                onRegenerate={() => {}}
                                onEdit={startEditMessage}
                                isEditing={editingMessageId === reply.id}
                                editedContent={editingMessageId === reply.id ? editedMessageContent : ''}
                                onEditedContentChange={setEditedMessageContent}
                                onSaveEdit={saveEditedMessage}
                                onCancelEdit={cancelEditMessage}
                                onDelete={deleteMessage}
                                onBranch={branchConversation}
                                onImageClick={(imageData) => setLightboxImage(imageData)}
                                onOpenArtifact={() => {}}
                                hasArtifact={false}
                                showThinking={thinkingEnabled && reply.role === 'assistant'}
                                highContrast={highContrast}
                                language={language}
                                isThreadReply={true}
                                onMessageReferenceClick={scrollToMessage}
                                highlightedMessageId={highlightedMessageId}
                              />
                            ))}
                          </div>
                        )}
                        {hasThread && !isThreadExpanded && (
                          <button
                            onClick={() => setExpandedThreads(prev => [...prev, message.id])}
                            className="ml-8 pl-4 mt-1 text-sm text-primary-500 hover:text-primary-600 dark:text-primary-400 flex items-center gap-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 18 15 12 9 6"></polyline>
                            </svg>
                            {threadReplies.length} {threadReplies.length === 1 ? 'reply' : 'replies'}
                          </button>
                        )}
                      </div>
                    );
                  });
                })()}
                {isStreaming && <TypingIndicator />}

                {/* Response Suggestions */}
                {!isStreaming && messages.length > 0 && responseSuggestions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Suggested follow-ups:</p>
                    <div className="flex flex-wrap gap-2">
                      {responseSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setInput(suggestion);
                            inputRef.current?.focus();
                          }}
                          className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-left border border-gray-200 dark:border-gray-700"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div
            className={`p-4 border-t border-gray-200 dark:border-gray-700 relative ${isDragging ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {/* Drag and drop overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-primary-100/80 dark:bg-primary-900/50 border-4 border-dashed border-primary-500 rounded-lg">
                <div className="text-center">
                  <div className="text-4xl mb-2">📁</div>
                  <div className="text-lg font-medium text-primary-700 dark:text-primary-300">
                    Drop image to upload
                  </div>
                </div>
              </div>
            )}
            {/* Image Upload Preview */}
            {uploadedImages.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3 max-w-4xl mx-auto">
                {uploadedImages.map(image => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.data}
                      alt={image.name}
                      className="w-16 h-16 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                    <button
                      onClick={() => removeUploadedImage(image.id)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                {/* Show recording indicator */}
                {isRecordingVoice && (
                  <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 rounded-full text-sm">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      Recording...
                    </div>
                  </div>
                )}
                {/* Rich Text Formatting Toolbar */}
                <div className={`flex items-center gap-1 mb-2 pb-2 border-b ${highContrast ? 'border-gray-300' : 'border-gray-200 dark:border-gray-700'}`}>
                  <button
                    type="button"
                    onClick={applyBold}
                    className={`p-2 rounded-lg transition-colors ${highContrast ? 'hover:bg-gray-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-700 dark:text-gray-300`}
                    title="Bold (Ctrl+B)"
                    aria-label="Bold"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
                      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={applyItalic}
                    className={`p-2 rounded-lg transition-colors ${highContrast ? 'hover:bg-gray-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-700 dark:text-gray-300`}
                    title="Italic (Ctrl+I)"
                    aria-label="Italic"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="19" y1="4" x2="10" y2="4"/>
                      <line x1="14" y1="20" x2="5" y2="20"/>
                      <line x1="15" y1="4" x2="9" y2="20"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={applyStrikethrough}
                    className={`p-2 rounded-lg transition-colors ${highContrast ? 'hover:bg-gray-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-700 dark:text-gray-300`}
                    title="Strikethrough"
                    aria-label="Strikethrough"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="4" y1="12" x2="20" y2="12"/>
                      <path d="M17.5 7.5c-1.5-2-3.5-3-6-3-3.5 0-6 2-6 5 0 2 1.5 3.5 3 4.5"/>
                      <path d="M8.5 16.5c1 1 2 1.5 4.5 1.5 3 0 5.5-1.5 5.5-4 0-1.5-.5-2.5-2-3.5"/>
                    </svg>
                  </button>
                  <div className={`w-px h-5 mx-1 ${highContrast ? 'bg-gray-300' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <button
                    type="button"
                    onClick={applyCode}
                    className={`p-2 rounded-lg transition-colors ${highContrast ? 'hover:bg-gray-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-700 dark:text-gray-300`}
                    title="Inline code"
                    aria-label="Inline code"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6"/>
                      <polyline points="8 6 2 12 8 18"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={applyLink}
                    className={`p-2 rounded-lg transition-colors ${highContrast ? 'hover:bg-gray-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-700 dark:text-gray-300`}
                    title="Insert link"
                    aria-label="Insert link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                  </button>
                  <div className={`w-px h-5 mx-1 ${highContrast ? 'bg-gray-300' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <button
                    type="button"
                    onClick={applyBulletList}
                    className={`p-2 rounded-lg transition-colors ${highContrast ? 'hover:bg-gray-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-700 dark:text-gray-300`}
                    title="Bullet list"
                    aria-label="Bullet list"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="8" y1="6" x2="21" y2="6"/>
                      <line x1="8" y1="12" x2="21" y2="12"/>
                      <line x1="8" y1="18" x2="21" y2="18"/>
                      <line x1="3" y1="6" x2="3.01" y2="6"/>
                      <line x1="3" y1="12" x2="3.01" y2="12"/>
                      <line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={applyNumberedList}
                    className={`p-2 rounded-lg transition-colors ${highContrast ? 'hover:bg-gray-300' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} text-gray-700 dark:text-gray-300`}
                    title="Numbered list"
                    aria-label="Numbered list"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="10" y1="6" x2="21" y2="6"/>
                      <line x1="10" y1="12" x2="21" y2="12"/>
                      <line x1="10" y1="18" x2="21" y2="18"/>
                      <path d="M4 6h1v4"/>
                      <path d="M4 10h2"/>
                      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
                    </svg>
                  </button>
                </div>
                <label htmlFor="message-input" className="sr-only">Type your message</label>
                <textarea
                  id="message-input"
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    const newValue = e.target.value;
                    setInput(newValue);
                    // Auto-resize textarea
                    e.target.style.height = 'auto';
                    const newHeight = Math.min(e.target.scrollHeight, 200); // max 200px
                    e.target.style.height = newHeight + 'px';
                    // Detect slash commands
                    if (newValue.startsWith('/')) {
                      const match = newValue.match(/^\/(\S*)/);
                      if (match) {
                        setSlashFilter(match[1]);
                        setShowSlashMenu(true);
                        setSlashCommandIndex(0);
                        setShowMentionMenu(false);
                      }
                    } else {
                      setShowSlashMenu(false);
                      setSlashFilter('');
                    }
                    // Detect @ mentions
                    const mentionMatch = newValue.match(/@(\S*)$/);
                    if (mentionMatch) {
                      setMentionFilter(mentionMatch[1]);
                      setShowMentionMenu(true);
                      setMentionIndex(0);
                    } else {
                      setShowMentionMenu(false);
                      setMentionFilter('');
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Type '/' for commands, '@' to mention..."
                  rows={1}
                  className={`w-full px-4 py-3 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 ${highContrast ? 'bg-white border-2 border-black text-black' : 'bg-gray-100 dark:bg-gray-800'} ${language === 'ar' || language === 'fa' || language === 'he' || language === 'ur' ? 'text-right' : ''}`}
                  style={{ minHeight: '48px', maxHeight: '200px', overflowY: input.length > 2000 ? 'auto' : 'hidden', direction: (language === 'ar' || language === 'fa' || language === 'he' || language === 'ur') ? 'rtl' : 'ltr' }}
                  aria-label="Message input"
                />
                {/* Character count and token estimation for long messages */}
                {input.length > 0 && (
                  <div className={`flex items-center justify-end gap-4 mt-1 px-1 text-xs ${highContrast ? 'text-gray-600' : 'text-gray-500 dark:text-gray-400'}`}>
                    <span>{input.length.toLocaleString()} characters</span>
                    <span>~{Math.ceil(input.length / 4).toLocaleString()} tokens</span>
                  </div>
                )}
                {/* Slash Commands Menu */}
                {showSlashMenu && filteredSlashCommands.length > 0 && (
                  <div className={`absolute z-50 mt-1 w-72 rounded-xl border shadow-lg overflow-hidden ${highContrast ? 'bg-white border-black' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className={`px-3 py-2 text-xs font-medium border-b ${highContrast ? 'border-black bg-gray-100' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'} text-gray-500 dark:text-gray-400`}>
                      Commands
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {filteredSlashCommands.map((cmd, idx) => (
                        <button
                          key={cmd.command}
                          onClick={() => {
                            cmd.action();
                            setShowSlashMenu(false);
                            setSlashFilter('');
                          }}
                          onMouseEnter={() => setSlashCommandIndex(idx)}
                          className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                            idx === slashCommandIndex
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            idx === slashCommandIndex
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            {cmd.icon === 'plus' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            )}
                            {cmd.icon === 'trash' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            )}
                            {cmd.icon === 'search' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            )}
                            {cmd.icon === 'settings' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            )}
                            {cmd.icon === 'download' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            )}
                            {cmd.icon === 'cpu' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
                            )}
                            {cmd.icon === 'moon' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                            )}
                            {cmd.icon === 'maximize' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                            )}
                            {cmd.icon === 'help' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            )}
                            {cmd.icon === 'pin' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            )}
                            {cmd.icon === 'archive' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                            )}
                            {cmd.icon === 'bookmark' && (
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                            )}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${highContrast ? 'text-black' : 'text-gray-900 dark:text-gray-100'}`}>
                              {cmd.label}
                            </div>
                            <div className={`text-xs truncate ${highContrast ? 'text-gray-700' : 'text-gray-500 dark:text-gray-400'}`}>
                              {cmd.description}
                            </div>
                          </div>
                          <span className={`text-xs ${highContrast ? 'text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}>
                            /{cmd.command}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Mention Menu */}
                {showMentionMenu && filteredMentions.length > 0 && (
                  <div className={`absolute z-50 mt-1 w-72 rounded-xl border shadow-lg overflow-hidden ${highContrast ? 'bg-white border-black' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                    <div className={`px-3 py-2 text-xs font-medium border-b ${highContrast ? 'border-black bg-gray-100' : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900'} text-gray-500 dark:text-gray-400`}>
                      Mentions
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {filteredMentions.map((mention, idx) => (
                        <button
                          key={mention.id}
                          onClick={() => {
                            setInput(prev => prev.replace(/@\S*$/, `@${mention.label} `));
                            setShowMentionMenu(false);
                            setMentionFilter('');
                            inputRef.current?.focus();
                          }}
                          onMouseEnter={() => setMentionIndex(idx)}
                          className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                            idx === mentionIndex
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                            idx === mentionIndex
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                              <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${highContrast ? 'text-black' : 'text-gray-900 dark:text-gray-100'}`}>
                              {mention.label}
                            </div>
                            <div className={`text-xs truncate ${highContrast ? 'text-gray-700' : 'text-gray-500 dark:text-gray-400'}`}>
                              {mention.description}
                            </div>
                          </div>
                          <span className={`text-xs ${highContrast ? 'text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}>
                            @{mention.id}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Markdown Preview Panel */}
                {showMarkdownPreview && input.trim() && (
                  <div className={`mt-2 p-3 rounded-xl border ${highContrast ? 'bg-white border-black' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Markdown Preview</span>
                      <button
                        onClick={() => setShowMarkdownPreview(false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        aria-label="Close preview"
                      >
                        ×
                      </button>
                    </div>
                    <div className="markdown-content text-sm max-h-60 overflow-y-auto">
                      <ReactMarkdown>{input}</ReactMarkdown>
                    </div>
                  </div>
                )}
                {/* Show raw markdown when preview is disabled and there's content */}
                {!showMarkdownPreview && input.trim() && (
                  <div className={`mt-2 p-3 rounded-xl border ${highContrast ? 'bg-white border-black' : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Raw Markdown</span>
                    </div>
                    <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-mono max-h-60 overflow-y-auto" dir={language === 'ar' || language === 'fa' || language === 'he' || language === 'ur' ? 'rtl' : 'ltr'}>{input}</pre>
                  </div>
                )}
              </div>
              {/* Hidden file input for image upload */}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              {/* Image Upload Button */}
              <label
                htmlFor="image-upload"
                className="p-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-pointer transition-colors"
                title="Attach image"
                aria-label="Attach image"
              >
                <Icons.Image />
              </label>
              {/* Markdown Preview Toggle */}
              <button
                onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                className={`p-3 rounded-xl transition-colors ${showMarkdownPreview ? 'bg-primary-500 hover:bg-primary-600 text-white' : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'}`}
                title={showMarkdownPreview ? 'Hide markdown preview' : 'Show markdown preview'}
                aria-label={showMarkdownPreview ? 'Hide markdown preview' : 'Show markdown preview'}
                aria-pressed={showMarkdownPreview}
              >
                {showMarkdownPreview ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
              {/* Voice Input Button */}
              <button
                onClick={toggleVoiceRecording}
                className={`p-3 rounded-xl transition-colors ${
                  isRecordingVoice
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                }`}
                title={isRecordingVoice ? 'Stop recording' : 'Voice input (mock)'}
                aria-label={isRecordingVoice ? 'Stop voice recording' : 'Voice input (mock)'}
                aria-pressed={isRecordingVoice}
              >
                {isRecordingVoice ? <Icons.MicOff /> : <Icons.Mic />}
              </button>
              {/* Save Prompt to Library Button */}
              <button
                onClick={() => {
                  setPromptTitle('');
                  setPromptDescription('');
                  setPromptCategory('General');
                  setShowSavePromptModal(true);
                }}
                disabled={!input.trim() || isLoading}
                className="p-3 rounded-xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Save prompt to library"
                aria-label="Save prompt to library"
              >
                <Icons.BookmarkPlus />
              </button>
              {isStreaming ? (
                <button
                  onClick={stopGeneration}
                  className="p-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors"
                  aria-label="Stop generation"
                >
                  <Icons.Stop />
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
                  className="p-3 rounded-xl bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  aria-label="Send message"
                  aria-disabled={(!input.trim() && uploadedImages.length === 0) || isLoading}
                >
                  <Icons.Send />
                </button>
              )}
            </div>
            {/* Undo Send Message Banner */}
            {undoMessage && (
              <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-2 mb-2">
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Message sent
                </span>
                <button
                  onClick={undoSendMessage}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                >
                  Undo
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Press Enter to send, Shift+Enter for new line, Ctrl/Cmd+V to paste image
              </p>
              {input.trim() && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {input.length} chars · ~{Math.ceil(input.length / 4)} tokens
                </p>
              )}
            </div>
          </div>
          </div>

          {/* Artifact Panel - slides in from right */}
          <div className={`${isArtifactPanelOpen ? 'w-96' : 'w-0'} flex-shrink-0 border-l border-gray-200 dark:border-gray-700 transition-all duration-300 overflow-hidden ${isArtifactPanelOpen ? 'bg-white dark:bg-gray-800' : ''}`}>
            {isArtifactPanelOpen && (
              <ArtifactPanel
                artifact={activeArtifact}
                isOpen={isArtifactPanelOpen}
                onClose={() => setIsArtifactPanelOpen(false)}
                onFullscreen={() => setIsArtifactFullscreen(!isArtifactFullscreen)}
                isFullscreen={isArtifactFullscreen}
                versions={activeArtifact ? artifactVersions[activeArtifact.id] || [] : []}
                onVersionChange={(version) => {
                  if (activeArtifact) {
                    setActiveArtifact({ ...activeArtifact, content: version.content });
                  }
                }}
                onEdit={() => setEditingArtifact(activeArtifact)}
                onDownload={() => {
                  if (activeArtifact) {
                    const blob = new Blob([activeArtifact.content], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${activeArtifact.title || 'artifact'}.${activeArtifact.language || 'txt'}`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                onRePrompt={() => {
                  if (activeArtifact) {
                    setInput(`Please update this ${activeArtifact.type} artifact:\n\n${activeArtifact.content}`);
                  }
                }}
                artifactPanelTab={artifactPanelTab}
                setArtifactPanelTab={setArtifactPanelTab}
              />
            )}
          </div>
        </div>

        {/* Folder/Project Creation Modal with Templates */}
        {showFolderModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => { setShowFolderModal(false); setShowTemplates(false); setSelectedTemplate(null); setNewFolderName(''); setNewFolderDescription(''); setNewFolderColor('#CC785C'); setIsEditingFolder(false); setEditingFolderId(null); }}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{isEditingFolder ? 'Edit Project' : 'Create New Project'}</h3>
                {/* Tab buttons for edit mode */}
                {isEditingFolder && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFolderTab('details')}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        folderTab === 'details'
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setFolderTab('analytics')}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                        folderTab === 'analytics'
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>📊</span> Analytics
                    </button>
                    <button
                      onClick={() => setFolderTab('knowledge')}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1 ${
                        folderTab === 'knowledge'
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>📚</span> Knowledge Base
                    </button>
                  </div>
                )}
              </div>

              {/* Tab buttons for Name/Template (only in create mode) */}
              {!isEditingFolder && !showTemplates && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setShowTemplates(true)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm flex items-center gap-2"
                  >
                    <span>📋</span> Use Template
                  </button>
                </div>
              )}

              {/* Analytics Tab Content */}
              {isEditingFolder && folderTab === 'analytics' && (
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-4">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{folderAnalytics?.conversation_count || 0}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Conversations</div>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{folderAnalytics?.message_count || 0}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Messages</div>
                      </div>
                    </div>

                    {/* Token Usage */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="font-medium text-sm mb-3">Token Usage</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Input Tokens</span>
                          <span className="font-medium">{(folderAnalytics?.input_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Output Tokens</span>
                          <span className="font-medium">{(folderAnalytics?.output_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-gray-200 dark:border-gray-600 pt-2">
                          <span className="text-gray-500 dark:text-gray-400">Total Tokens</span>
                          <span className="font-bold">{(folderAnalytics?.total_tokens || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Estimated Cost</span>
                          <span className="font-medium text-primary-500">${(folderAnalytics?.estimated_cost || 0).toFixed(4)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    {folderAnalytics?.recent_activity && folderAnalytics.recent_activity.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <h4 className="font-medium text-sm mb-3">Recent Activity (Last 7 Days)</h4>
                        <div className="space-y-2">
                          {folderAnalytics.recent_activity.map((day, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-gray-500 dark:text-gray-400">{day.date}</span>
                              <span className="font-medium">{day.message_count} messages</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Usage by Model */}
                    {folderAnalytics?.usage_by_model && folderAnalytics.usage_by_model.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <h4 className="font-medium text-sm mb-3">Usage by Model</h4>
                        <div className="space-y-2">
                          {folderAnalytics.usage_by_model.map((model, idx) => (
                            <div key={idx} className="text-sm">
                              <div className="flex justify-between mb-1">
                                <span className="font-medium">{model.model || 'Default'}</span>
                                <span className="text-gray-500 dark:text-gray-400">{model.message_count} messages</span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                                <div
                                  className="bg-primary-500 h-1.5 rounded-full"
                                  style={{ width: `${Math.min((model.message_count / (folderAnalytics?.message_count || 1)) * 100, 100)}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Empty state */}
                    {(!folderAnalytics || (folderAnalytics?.conversation_count === 0 && folderAnalytics?.message_count === 0)) && (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <div className="text-4xl mb-2">📊</div>
                        <p>No analytics data yet</p>
                        <p className="text-sm mt-1">Start a conversation in this project to see stats</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Templates View */}
              {!isEditingFolder && showTemplates ? (
                <div className="flex flex-col max-h-[60vh]">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">Choose a Template</h4>
                    <button
                      onClick={() => setShowTemplates(false)}
                      className="text-sm text-primary-500 hover:text-primary-600"
                    >
                      Back to custom
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {projectTemplates.map(template => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplate(template);
                          setNewFolderName(template.name);
                          setShowTemplates(false);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedTemplate?.id === template.id
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{template.icon}</span>
                          <div>
                            <div className="font-medium">{template.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{template.description}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {selectedTemplate && selectedTemplate.id !== 'blank' && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-2 rounded mb-3">
                      <strong>Template instructions:</strong> This project will include custom AI instructions.
                    </div>
                  )}
                </div>
              ) : folderTab === 'details' ? (
                /* Details Tab - Normal Name Input View */
                <div className="flex-1 overflow-y-auto">
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Project Name</label>
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={e => setNewFolderName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (isEditingFolder ? updateFolder() : createFolder())}
                      placeholder="Enter project name"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      autoFocus
                    />
                  </div>

                  {/* Description Field */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Description {isEditingFolder ? '' : '(optional)'}
                    </label>
                    <textarea
                      value={newFolderDescription}
                      onChange={e => setNewFolderDescription(e.target.value)}
                      placeholder="Enter project description"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    />
                  </div>

                  {/* Color Picker */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Color {isEditingFolder ? '' : '(optional)'}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {folderColors.map(colorOption => (
                        <button
                          key={colorOption.id}
                          onClick={() => setNewFolderColor(colorOption.color)}
                          className={`w-8 h-8 rounded-full transition-transform ${
                            newFolderColor === colorOption.color ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: colorOption.color }}
                          title={colorOption.name}
                          aria-label={colorOption.name}
                        />
                      ))}
                    </div>
                  </div>

                  {selectedTemplate && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <span>{selectedTemplate.icon}</span>
                        <span className="font-medium text-sm">{selectedTemplate.name}</span>
                        <button
                          onClick={() => setSelectedTemplate(null)}
                          className="ml-auto text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          Remove
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{selectedTemplate.description}</p>
                    </div>
                  )}
                </div>
              ) : folderTab === 'knowledge' ? (
                /* Knowledge Base Tab */
                <div className="flex-1 overflow-y-auto">
                  <div className="mb-4">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Upload documents to create a knowledge base for this project. These files will help Claude understand project-specific context.
                    </p>

                    {/* Upload Button */}
                    <label className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-2 border-dashed border-primary-300 dark:border-primary-700 rounded-lg cursor-pointer hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
                      <span className="text-xl">📄</span>
                      <span className="text-sm font-medium text-primary-600 dark:text-primary-400">Click to upload files</span>
                      <input
                        type="file"
                        multiple
                        accept=".txt,.md,.pdf,.doc,.docx,.json,.csv,.xml,.html,.css,.js,.ts,.py"
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files);
                          if (files.length === 0) return;

                          setKnowledgeBaseUploading(true);
                          for (const file of files) {
                            try {
                              const reader = new FileReader();
                              const fileData = await new Promise((resolve) => {
                                reader.onload = () => resolve(reader.result);
                                reader.readAsDataURL(file);
                              });

                              const response = await fetch(`${API_BASE}/projects/${editingFolderId}/knowledge`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  file_name: file.name,
                                  file_type: file.type || 'application/octet-stream',
                                  file_data: fileData
                                })
                              });

                              if (response.ok) {
                                const data = await response.json();
                                setKnowledgeBaseFiles(prev => [data.file, ...prev]);
                              }
                            } catch (error) {
                              console.error('Error uploading file:', error);
                            }
                          }
                          setKnowledgeBaseUploading(false);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {knowledgeBaseUploading && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-primary-500">
                        <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                        Uploading files...
                      </div>
                    )}
                  </div>

                  {/* Files List */}
                  {knowledgeBaseLoading ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                      Loading files...
                    </div>
                  ) : knowledgeBaseFiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">📂</div>
                      <p>No files uploaded yet</p>
                      <p className="text-sm mt-1">Upload documents to build your knowledge base</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                        {knowledgeBaseFiles.length} file{knowledgeBaseFiles.length !== 1 ? 's' : ''} uploaded
                      </p>
                      {knowledgeBaseFiles.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl flex-shrink-0">{
                              file.file_name.endsWith('.pdf') ? '📕' :
                              file.file_name.endsWith('.md') ? '📝' :
                              file.file_name.endsWith('.txt') ? '📄' :
                              file.file_name.endsWith('.json') ? '📋' :
                              file.file_name.endsWith('.csv') ? '📊' :
                              file.file_name.endsWith('.py') ? '🐍' :
                              file.file_name.endsWith('.js') || file.file_name.endsWith('.ts') ? '💻' :
                              '📁'
                            }</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{file.file_name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {(file.file_size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              try {
                                const response = await fetch(`${API_BASE}/projects/${editingFolderId}/knowledge/${file.id}`, {
                                  method: 'DELETE'
                                });
                                if (response.ok) {
                                  setKnowledgeBaseFiles(prev => prev.filter(f => f.id !== file.id));
                                }
                              } catch (error) {
                                console.error('Error deleting file:', error);
                              }
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete file"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowFolderModal(false);
                    setShowTemplates(false);
                    setSelectedTemplate(null);
                    setNewFolderName('');
                    setNewFolderDescription('');
                    setNewFolderColor('#CC785C');
                    setIsEditingFolder(false);
                    setEditingFolderId(null);
                  }}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={isEditingFolder ? updateFolder : createFolder}
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditingFolder ? 'Save Changes' : 'Create'}
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

        {/* Batch Export All Data Modal */}
        {showBatchExportModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowBatchExportModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Export All Data</h3>
                <button
                  onClick={() => setShowBatchExportModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setBatchExportFormat('json')}
                  className={`px-4 py-2 rounded-lg transition-colors ${batchExportFormat === 'json' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  JSON
                </button>
                <button
                  onClick={() => setBatchExportFormat('csv')}
                  className={`px-4 py-2 rounded-lg transition-colors ${batchExportFormat === 'csv' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}
                >
                  CSV
                </button>
              </div>
              {batchExportFormat === 'csv' && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    CSV export will include conversations and messages in a flat format.
                    For full data with all metadata, use JSON format.
                  </p>
                </div>
              )}
              <div className="flex-1 overflow-auto mb-4">
                {batchExportData ? (
                  <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-4 rounded-lg overflow-auto max-h-96">
                    {batchExportFormat === 'json'
                      ? batchExportData
                      : 'CSV preview not available - download to view'}
                  </pre>
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowBatchExportModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    if (batchExportData) {
                      let content = batchExportData;
                      let mimeType = 'application/json';
                      let extension = 'json';

                      if (batchExportFormat === 'csv') {
                        // Convert JSON to CSV
                        try {
                          const data = JSON.parse(batchExportData);
                          // Create CSV with conversations and messages
                          const csvRows = ['Type,ID,Title,Content,Created At'];

                          // Add conversations
                          if (data.conversations) {
                            data.conversations.forEach(conv => {
                              csvRows.push(`conversation,"${(conv.id || '').replace(/"/g, '""')}","${(conv.title || '').replace(/"/g, '""')}","","${conv.created_at || ''}"`);
                              // Add messages
                              if (conv.messages) {
                                conv.messages.forEach(msg => {
                                  const content = (msg.content || '').replace(/"/g, '""').substring(0, 500);
                                  csvRows.push(`message,"${(msg.id || '').replace(/"/g, '""')}","","${content}","${msg.created_at || ''}"`);
                                });
                              }
                            });
                          }

                          content = csvRows.join('\n');
                          mimeType = 'text/csv';
                          extension = 'csv';
                        } catch (e) {
                          console.error('CSV conversion error:', e);
                          showToast('Failed to convert to CSV', 'error');
                          return;
                        }
                      }

                      const blob = new Blob([content], { type: mimeType });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `claude-clone-export-${new Date().toISOString().split('T')[0]}.${extension}`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showToast(`Data exported as ${extension.toUpperCase()}`, 'success');
                    }
                  }}
                  disabled={!batchExportData}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Download {batchExportFormat === 'json' ? 'JSON' : 'CSV'}
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

              {/* Expiration Settings */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Link Expiration</label>
                <div className="flex gap-2 mb-3">
                  <select
                    value={shareExpiration}
                    onChange={(e) => setShareExpiration(parseInt(e.target.value))}
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                  >
                    <option value={0}>Never expires</option>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                  <button
                    onClick={() => {
                      if (selectedConversation) {
                        shareConversation(selectedConversation);
                      }
                    }}
                    className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
                  >
                    Create New Link
                  </button>
                </div>
              </div>

              {/* Share Link Display */}
              {shareLink && (
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
              )}

              {shareData?.expires_at ? (
                <p className="text-xs text-gray-500 mb-4">
                  Expires: {new Date(shareData.expires_at).toLocaleDateString()}
                </p>
              ) : shareExpiration === 0 ? (
                <p className="text-xs text-gray-500 mb-4">
                  This link never expires
                </p>
              ) : null}

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

        {/* Change Password Modal */}
        {showChangePassword && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowChangePassword(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Change Password</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Current Password</label>
                  <input
                    type="password"
                    id="current-password"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <input
                    type="password"
                    id="new-password"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                    placeholder="Enter new password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirm-password"
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Note: This is a demo. Password change is simulated.
              </p>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowChangePassword(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const current = document.getElementById('current-password').value;
                    const newPass = document.getElementById('new-password').value;
                    const confirm = document.getElementById('confirm-password').value;

                    if (!current) {
                      alert('Please enter your current password');
                      return;
                    }
                    if (newPass.length < 6) {
                      alert('New password must be at least 6 characters');
                      return;
                    }
                    if (newPass !== confirm) {
                      alert('New passwords do not match');
                      return;
                    }
                    alert('Password changed successfully! (Demo)');
                    setShowChangePassword(false);
                  }}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
                >
                  Change Password
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Email Modal */}
        {showChangeEmail && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowChangeEmail(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Edit Profile</h3>

              <div className="space-y-4">
                {/* Avatar Upload */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                    {userProfile?.avatar ? (
                      <img id="avatar-preview" src={userProfile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span id="avatar-initial" className="text-2xl font-medium text-gray-500">{userProfile?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                    )}
                  </div>
                  <div>
                    <input
                      type="file"
                      id="avatar-upload"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const preview = document.getElementById('avatar-preview');
                            const initial = document.getElementById('avatar-initial');
                            if (preview) {
                              preview.src = event.target.result;
                              preview.style.display = 'block';
                            }
                            if (initial) {
                              initial.style.display = 'none';
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <button
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      Upload Avatar
                    </button>
                    <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    id="change-name"
                    defaultValue={userProfile?.name || ''}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    id="change-email"
                    defaultValue={userProfile?.email || ''}
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Note: This is a demo. Profile changes are simulated.
              </p>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setShowChangeEmail(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const newName = document.getElementById('change-name').value;
                    const newEmail = document.getElementById('change-email').value;
                    const avatarPreview = document.getElementById('avatar-preview');
                    const newAvatar = avatarPreview?.src || null;

                    if (!newName.trim()) {
                      alert('Please enter your name');
                      return;
                    }
                    if (!newEmail.trim() || !newEmail.includes('@')) {
                      alert('Please enter a valid email');
                      return;
                    }

                    // Update user profile
                    setUserProfile(prev => ({ ...prev, name: newName, email: newEmail, avatar: newAvatar }));
                    localStorage.setItem('userProfile', JSON.stringify({ name: newName, email: newEmail, avatar: newAvatar }));

                    alert('Profile updated successfully! (Demo)');
                    setShowChangeEmail(false);
                  }}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Two-Factor Authentication Modal */}
        {showTwoFactorModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowTwoFactorModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-md shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-4">Two-Factor Authentication</h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Add an extra layer of security to your account by requiring a verification code in addition to your password.
              </p>

              {/* Mock QR Code */}
              <div className="flex flex-col items-center mb-6">
                <div className="w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-gray-400">
                      <rect x="3" y="3" width="7" height="7"></rect>
                      <rect x="14" y="3" width="7" height="7"></rect>
                      <rect x="3" y="14" width="7" height="7"></rect>
                      <rect x="14" y="14" width="3" height="3"></rect>
                      <rect x="18" y="14" width="3" height="3"></rect>
                      <rect x="14" y="18" width="3" height="3"></rect>
                      <rect x="18" y="18" width="3" height="3"></rect>
                    </svg>
                    <p className="text-xs text-gray-500 mt-2">(Mock QR Code)</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">Scan this QR code with your authenticator app</p>
              </div>

              {/* Backup Codes */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-2">Backup Codes</h4>
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <span>1234-5678-ABCD</span>
                    <span>EFGH-9012-3456</span>
                    <span>7890-IJKL-2345</span>
                    <span>MNOP-6789-0123</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Save these codes in a safe place. They can be used to access your account if you lose your phone.</p>
              </div>

              <p className="text-xs text-gray-500 mb-4">
                Note: This is a demo. 2FA setup is simulated.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowTwoFactorModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    alert('Two-factor authentication enabled! (Demo)');
                    setShowTwoFactorModal(false);
                  }}
                  className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm"
                >
                  Enable 2FA
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Merge Conversations Modal */}
        {showMergeModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowMergeModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold mb-2">Merge Conversations</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Merge another conversation into "{mergeSourceConversation?.title || 'Untitled'}". All messages from the source will be moved to the target conversation.
              </p>

              {/* Source Conversation (Read-only) */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-gray-500">Source (will be deleted)</label>
                <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="font-medium">{mergeSourceConversation?.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500">{mergeSourceConversation?.message_count || 0} messages</p>
                </div>
              </div>

              {/* Target Conversation Selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Merge into (target)</label>
                <select
                  value={mergeTargetConversation?.id || ''}
                  onChange={(e) => {
                    const conv = conversations.find(c => c.id === e.target.value);
                    setMergeTargetConversation(conv || null);
                  }}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                >
                  <option value="">Select a conversation...</option>
                  {conversations
                    .filter(c => c.id !== mergeSourceConversation?.id && !c.is_archived && !c.is_deleted)
                    .map(conv => (
                      <option key={conv.id} value={conv.id}>
                        {conv.title || 'Untitled'} ({conv.message_count || 0} messages)
                      </option>
                    ))}
                </select>
              </div>

              {/* Warning */}
              {mergeTargetConversation && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    <strong>Warning:</strong> The source conversation "{mergeSourceConversation?.title || 'Untitled'}" will be permanently deleted after merging.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowMergeModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  disabled={isMerging}
                >
                  Cancel
                </button>
                <button
                  onClick={mergeConversations}
                  disabled={!mergeTargetConversation || isMerging}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isMerging ? 'Merging...' : 'Merge Conversations'}
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

        {/* Image Lightbox Modal */}
        {lightboxImage && (
          <div
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
            onClick={() => setLightboxImage(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
              onClick={() => setLightboxImage(null)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img
              src={lightboxImage}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Artifact Edit Modal */}
        {editingArtifact && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setEditingArtifact(null)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-3xl shadow-xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Artifact</h3>
                <button
                  onClick={() => setEditingArtifact(null)}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto mb-4">
                <textarea
                  value={editingArtifact.content}
                  onChange={(e) => setEditingArtifact({ ...editingArtifact, content: e.target.value })}
                  className="w-full h-64 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Edit artifact content..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setEditingArtifact(null)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEditedArtifact}
                  className="px-4 py-2 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} temperature={temperature} setTemperature={setTemperature} topP={topP} setTopP={setTopP} maxTokens={maxTokens} setMaxTokens={setMaxTokens} thinkingEnabled={thinkingEnabled} setThinkingEnabled={setThinkingEnabled} onOpenKeyboardShortcuts={() => { setShowSettings(false); setShowKeyboardShortcuts(true); }} highContrast={highContrast} setHighContrast={setHighContrast} reducedMotion={reducedMotion} setReducedMotion={setReducedMotion} systemPrompt={systemPrompt} onSystemPromptChange={handleSystemPromptChange} language={language} setLanguage={setLanguage} usageLimits={usageLimits} setUsageLimits={setUsageLimits} soundEffectsEnabled={soundEffectsEnabled} setSoundEffectsEnabled={setSoundEffectsEnabled} notificationSettings={notificationSettings} setNotificationSettings={setNotificationSettings} customInstructionTemplates={customInstructionTemplates} openCustomInstructionModal={openCustomInstructionModal} selectInstructionTemplate={selectInstructionTemplate} selectedInstructionTemplate={selectedInstructionTemplate} globalCustomInstructions={globalCustomInstructions} setGlobalCustomInstructions={setGlobalCustomInstructions} onExportAllData={exportAllData} showInstructionsPreview={showInstructionsPreview} setShowInstructionsPreview={setShowInstructionsPreview} previewTestPrompt={previewTestPrompt} setPreviewTestPrompt={setPreviewTestPrompt} previewResponse={previewResponse} previewLoading={previewLoading} testInstructionsPreview={testInstructionsPreview} activeSessions={activeSessions} sessionsLoading={sessionsLoading} fetchActiveSessions={fetchActiveSessions} logoutSession={logoutSession} logoutOtherSessions={logoutOtherSessions} />

        {/* Keyboard Shortcuts Modal */}
        <KeyboardShortcutsModal isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />

        {/* Custom Instruction Templates Modal */}
        {showCustomInstructionModal && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCustomInstructionModal(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-2xl shadow-xl max-h-[85vh] overflow-hidden flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Custom Instruction Templates</h3>
                <button
                  onClick={() => setShowCustomInstructionModal(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Template List */}
              <div className="flex-1 overflow-y-auto mb-4">
                <h4 className="font-medium text-sm mb-2">Saved Templates ({customInstructionTemplates.length})</h4>
                {customInstructionTemplates.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No templates saved yet. Create one below.</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {customInstructionTemplates.map(template => (
                      <div
                        key={template.id}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-sm">{template.name}</h5>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{template.instructions}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <button
                              onClick={() => editTemplate(template)}
                              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-primary-500"
                              title="Edit template"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteTemplate(template.id)}
                              className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500"
                              title="Delete template"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create/Edit Template Form */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="font-medium text-sm mb-3">
                  {editingInstructionTemplate ? 'Edit Template' : 'Create New Template'}
                </h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Template Name</label>
                    <input
                      type="text"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="e.g., Code Reviewer, Writing Assistant"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-black dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Custom Instructions</label>
                    <textarea
                      value={newTemplateInstructions}
                      onChange={(e) => setNewTemplateInstructions(e.target.value)}
                      placeholder="Enter the custom instructions for this template..."
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm text-black dark:text-white resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingInstructionTemplate && (
                      <button
                        onClick={() => {
                          setEditingInstructionTemplate(null);
                          setNewTemplateName('');
                          setNewTemplateInstructions('');
                        }}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel Edit
                      </button>
                    )}
                    <button
                      onClick={saveTemplate}
                      className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-lg transition-colors"
                    >
                      {editingInstructionTemplate ? 'Update Template' : 'Save Template'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Prompt Modal */}
        <SavePromptModal
          isOpen={showSavePromptModal}
          onClose={() => setShowSavePromptModal(false)}
          promptTitle={promptTitle}
          setPromptTitle={setPromptTitle}
          promptDescription={promptDescription}
          setPromptDescription={setPromptDescription}
          promptCategory={promptCategory}
          setPromptCategory={setPromptCategory}
          onSave={savePromptToLibrary}
          input={input}
        />

        {/* Prompt Library Modal */}
        <PromptLibraryModal
          isOpen={showPromptLibrary}
          onClose={() => setShowPromptLibrary(false)}
          prompts={savedPrompts}
          onSelectPrompt={(template) => {
            setInput(template);
            inputRef.current?.focus();
          }}
          onDeletePrompt={deletePromptFromLibrary}
          onEditPrompt={updatePromptInLibrary}
          onSaveNewPrompt={() => {
            setShowPromptLibrary(false);
            setShowSavePromptModal(true);
          }}
          input={input}
        />

        {/* Team Workspaces Modal */}
        {showWorkspaces && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowWorkspaces(false)}
          >
            <div
              className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Team Workspaces</h3>
                <button
                  onClick={() => setShowWorkspaces(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Mock Feature:</strong> Team workspaces are not yet functional. This is a placeholder UI for future team collaboration features.
                </p>
              </div>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Engineering Team</h4>
                    <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">Mock</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">3 members</p>
                  <button className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                    Share with Team
                  </button>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Design Team</h4>
                    <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">Mock</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">2 members</p>
                  <button className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                    Share with Team
                  </button>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Product Team</h4>
                    <span className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-full">Mock</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">5 members</p>
                  <button className="text-xs px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                    Share with Team
                  </button>
                </div>
              </div>
              <button className="mt-4 w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors text-sm">
                Create Workspace (Coming Soon)
              </button>
            </div>
          </div>
        )}

        {/* Command Palette */}
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          onNewChat={createConversation}
          onOpenSettings={() => setShowSettings(true)}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onSearch={setSearchQuery}
          onOpenPromptLibrary={openPromptLibrary}
          conversations={conversations}
          onSelectConversation={(conv) => {
            selectConversation(conv);
            setShowCommandPalette(false);
          }}
          apiBase={API_BASE}
        />

        {/* Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map(toast => (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[280px] max-w-md animate-slide-in ${
                toast.type === 'success' ? 'bg-green-500 text-white' :
                toast.type === 'error' ? 'bg-red-500 text-white' :
                toast.type === 'warning' ? 'bg-yellow-500 text-white' :
                'bg-gray-800 text-white dark:bg-gray-700'
              }`}
              role="alert"
            >
              {toast.type === 'success' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {toast.type === 'error' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {toast.type === 'warning' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
              {toast.type === 'info' && (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <span className="flex-1 text-sm">{toast.message}</span>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                aria-label="Dismiss notification"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Network Error Banner */}
        {showNetworkBanner && (
          <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-3 shadow-lg">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold">Connection Lost</p>
                  <p className="text-sm">{networkError || 'Unable to connect to the server. Please check your internet connection.'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isRecovering && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Reconnecting...</span>
                  </div>
                )}
                {isOnline && !isRecovering && lastFailedMessage && (
                  <button
                    onClick={retryLastMessage}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Retry
                  </button>
                )}
                {isOnline && !isRecovering && (
                  <button
                    onClick={() => {
                      setShowNetworkBanner(false);
                      setNetworkError(null);
                      setLastFailedMessage(null);
                    }}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeContext.Provider>
  );
}

// Command Palette Component
function CommandPalette({ isOpen, onClose, onNewChat, onOpenSettings, onToggleSidebar, onSearch, onOpenPromptLibrary, conversations, onSelectConversation, apiBase }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [messageResults, setMessageResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dateFilter, setDateFilter] = useState(''); // '', 'today', 'week', 'month', '3months', 'year', 'custom'
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const inputRef = useRef(null);

  // Calculate date range based on filter
  const getDateRange = () => {
    const now = new Date();
    let dateFrom = null;
    let dateTo = null;

    switch (dateFilter) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        dateTo = now.toISOString();
        break;
      case 'week':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        dateTo = now.toISOString();
        break;
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString();
        dateTo = now.toISOString();
        break;
      case '3months':
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();
        dateTo = now.toISOString();
        break;
      case 'year':
        dateFrom = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
        dateTo = now.toISOString();
        break;
      case 'custom':
        if (customDateFrom) dateFrom = new Date(customDateFrom).toISOString();
        if (customDateTo) dateTo = new Date(customDateTo + 'T23:59:59').toISOString();
        break;
      default:
        // No date filter
        break;
    }

    return { dateFrom, dateTo };
  };

  // Search messages when query changes
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setMessageResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      const { dateFrom, dateTo } = getDateRange();
      let url = `${apiBase}/search/messages?q=${encodeURIComponent(query)}`;
      if (dateFrom) url += `&date_from=${encodeURIComponent(dateFrom)}`;
      if (dateTo) url += `&date_to=${encodeURIComponent(dateTo)}`;

      fetch(url)
        .then(res => res.json())
        .then(data => {
          setMessageResults(Array.isArray(data) ? data.slice(0, 20) : []);
          setIsSearching(false);
        })
        .catch(() => {
          setMessageResults([]);
          setIsSearching(false);
        });
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [query, apiBase, dateFilter, customDateFrom, customDateTo]);

  // Highlight search term in text
  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm.trim() || !text) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/50 rounded px-0.5">{part}</mark> : part
    );
  };

  // Get preview snippet from message content
  const getMessageSnippet = (content, searchTerm, maxLength = 100) => {
    if (!content) return '';
    const lowerContent = content.toLowerCase();
    const lowerSearch = searchTerm.toLowerCase();
    const index = lowerContent.indexOf(lowerSearch);
    if (index === -1) return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
    const start = Math.max(0, index - 30);
    const end = Math.min(content.length, index + searchTerm.length + 50);
    let snippet = (start > 0 ? '...' : '') + content.substring(start, end) + (end < content.length ? '...' : '');
    return snippet;
  };

  // Available commands
  const allCommands = [
    { id: 'new-chat', name: 'New Chat', description: 'Start a new conversation', icon: 'plus', action: onNewChat, category: 'Actions' },
    { id: 'prompt-library', name: 'Prompt Library', description: 'Browse saved prompts', icon: 'bookmark', action: () => { onOpenPromptLibrary(); onClose(); }, category: 'Actions' },
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

  // Filter commands based on query - always include recent conversations
  const allItems = [...allCommands, ...conversationCommands];
  const filteredCommands = query.trim() === ''
    ? allItems  // Show all commands and recent conversations when no query
    : allItems.filter(cmd =>
        cmd.name.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description.toLowerCase().includes(query.toLowerCase())
      );

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});

  // Total items including message results
  const totalItems = filteredCommands.length + messageResults.length;

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // Check if selected item is a message result
        if (selectedIndex >= filteredCommands.length && messageResults[selectedIndex - filteredCommands.length]) {
          const msg = messageResults[selectedIndex - filteredCommands.length];
          onSelectConversation({ id: msg.conversation_id, title: msg.conversation_title });
          onClose();
        } else if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredCommands, selectedIndex, onClose, messageResults, totalItems]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setMessageResults([]);
      setDateFilter('');
      setCustomDateFrom('');
      setCustomDateTo('');
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
      case 'bookmark':
        return <Icons.Bookmark />;
      default:
        return null;
    }
  };

  let flatIndex = 0;

  // Add message results icon
  const MessageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );

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
            placeholder="Search commands, conversations, or messages..."
            className="w-full px-4 py-4 bg-transparent focus:outline-none text-base"
          />
          <kbd className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">ESC</kbd>
        </div>

        {/* Date Filter */}
        {query.length >= 2 && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Date:</span>
            <div className="flex flex-wrap gap-2">
              <select
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
                className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All Time</option>
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="3months">Past 3 Months</option>
                <option value="year">Past Year</option>
                <option value="custom">Custom Range</option>
              </select>
              {dateFilter === 'custom' && (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={customDateFrom}
                    onChange={e => setCustomDateFrom(e.target.value)}
                    className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="From"
                  />
                  <span className="text-xs text-gray-400">to</span>
                  <input
                    type="date"
                    value={customDateTo}
                    onChange={e => setCustomDateTo(e.target.value)}
                    className="px-2 py-1 text-xs bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="To"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {/* Message Search Results */}
          {query.length >= 2 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900 flex items-center gap-2">
                {isSearching ? (
                  <>
                    <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Searching messages...
                  </>
                ) : (
                  <>Messages ({messageResults.length})</>
                )}
              </div>
              {!isSearching && messageResults.length > 0 && messageResults.map((msg, idx) => {
                const currentIndex = filteredCommands.length + idx;
                const isSelected = currentIndex === selectedIndex;
                return (
                  <button
                    key={msg.id}
                    onClick={() => {
                      onSelectConversation({ id: msg.conversation_id, title: msg.conversation_title });
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(currentIndex)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected ? 'bg-primary-500/10 dark:bg-primary-500/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg mt-0.5 ${
                      isSelected ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <MessageIcon />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${isSelected ? 'text-primary-600 dark:text-primary-400' : ''}`}>
                        {msg.conversation_title || 'Untitled'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {msg.role === 'user' ? 'You: ' : 'Claude: '}
                        {highlightSearchTerm(getMessageSnippet(msg.content, query), query)}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </span>
                  </button>
                );
              })}
              {!isSearching && query.length >= 2 && messageResults.length === 0 && (
                <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No messages found for "{query}"
                </div>
              )}
            </div>
          )}

          {/* Command Results */}
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
          {filteredCommands.length === 0 && messageResults.length === 0 && !isSearching && (
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
