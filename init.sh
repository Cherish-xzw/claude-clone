#!/bin/bash
set -e
echo "=== Claude.ai Clone Setup ==="
cd "$(dirname "$0")"
echo "Installing backend..."
cd server && npm install 2>&1 | tail -3
cd ..
echo "Installing frontend..."
cd frontend && npm install 2>&1 | tail -3
echo ""
echo "=== Ready! ==="
echo "Start backend: cd server && node index.js"
echo "Start frontend: cd frontend && npm run dev"
