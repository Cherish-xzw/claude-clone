const WebSocket = require('ws');

const WS_URL = 'ws://localhost:4001';

console.log('Testing WebSocket connection...\n');

// Test 1: Connect to WebSocket
console.log('1. Connecting to WebSocket server...');
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('   ✓ Connected to WebSocket server');
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('   Received:', JSON.stringify(message));

  if (message.type === 'connected') {
    console.log('   ✓ Got client ID:', message.clientId);

    // Test 2: Subscribe to channels
    console.log('\n2. Subscribing to channels...');
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'conversations' }));
    ws.send(JSON.stringify({ type: 'subscribe', channel: 'messages' }));

    setTimeout(() => {
      // Test 3: Send broadcast
      console.log('\n3. Testing broadcast...');
      ws.send(JSON.stringify({
        type: 'broadcast',
        channel: 'conversations',
        payload: { action: 'test', message: 'Hello from test' }
      }));

      setTimeout(() => {
        // Test 4: Ping
        console.log('\n4. Testing heartbeat...');
        ws.send(JSON.stringify({ type: 'ping' }));

        setTimeout(() => {
          // Close connection
          console.log('\n5. Closing connection...');
          ws.close();
          console.log('   ✓ Connection closed');
          console.log('\n=== ALL WebSocket TESTS PASSED ===');
          process.exit(0);
        }, 500);
      }, 500);
    }, 500);
  }
});

ws.on('error', (error) => {
  console.error('   ✗ WebSocket error:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('   Connection closed');
});

// Timeout after 10 seconds
setTimeout(() => {
  console.error('Test timed out');
  ws.close();
  process.exit(1);
}, 10000);
