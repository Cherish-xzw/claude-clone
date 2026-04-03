# Claude.ai Clone

A fully functional clone of claude.ai built with autonomous coding agents.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Express.js + SQLite
- **API**: Claude API via MiniMax

## Features

200+ test cases covering:
- Chat with streaming responses
- Markdown/code rendering
- Conversation management
- Projects and folders
- Artifacts panel
- Model selection
- Settings and themes
- And more...

## Setup

```bash
./init.sh
```

## Start

```bash
# Terminal 1 - Backend
cd server && node index.js

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Project Structure

- `frontend/` - React application
- `server/` - Express backend
- `feature_list.json` - 200 test cases (source of truth)
- `init.sh` - Setup script
