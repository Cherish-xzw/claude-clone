#!/bin/bash
cd /private/tmp/autonomous-coding/generations/todo-app/server
pkill -f "node index.js" 2>/dev/null || true
sleep 1
node index.js > ../logs/backend-new.log 2>&1 &
echo "Server restarted"
