// API Test Script
const http = require('http');

function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('Testing API Endpoints...\n');

  // Test 1: Health check
  console.log('1. Health Check');
  try {
    const res = await makeRequest('GET', '/api/health');
    console.log(`   Status: ${res.status}, Response:`, res.data);
  } catch (e) {
    console.log('   ERROR:', e.message);
  }

  // Test 2: Get conversations
  console.log('\n2. Get Conversations');
  try {
    const res = await makeRequest('GET', '/api/conversations');
    console.log(`   Status: ${res.status}, Count: ${Array.isArray(res.data) ? res.data.length : 'N/A'}`);
  } catch (e) {
    console.log('   ERROR:', e.message);
  }

  // Test 3: Create conversation
  console.log('\n3. Create Conversation');
  try {
    const res = await makeRequest('POST', '/api/conversations', { model: 'claude-sonnet-4-5-20250929' });
    console.log(`   Status: ${res.status}, ID: ${res.data.id || 'N/A'}`);
    global.testConvId = res.data.id;
  } catch (e) {
    console.log('   ERROR:', e.message);
  }

  // Test 4: Get single conversation
  console.log('\n4. Get Single Conversation');
  if (global.testConvId) {
    try {
      const res = await makeRequest('GET', `/api/conversations/${global.testConvId}`);
      console.log(`   Status: ${res.status}, Title: ${res.data.title || 'None'}`);
    } catch (e) {
      console.log('   ERROR:', e.message);
    }
  }

  // Test 5: Get projects
  console.log('\n5. Get Projects');
  try {
    const res = await makeRequest('GET', '/api/projects');
    console.log(`   Status: ${res.status}, Count: ${Array.isArray(res.data) ? res.data.length : 'N/A'}`);
  } catch (e) {
    console.log('   ERROR:', e.message);
  }

  // Test 6: Get settings
  console.log('\n6. Get Settings');
  try {
    const res = await makeRequest('GET', '/api/settings');
    console.log(`   Status: ${res.status}, Theme: ${res.data.theme || 'N/A'}`);
  } catch (e) {
    console.log('   ERROR:', e.message);
  }

  console.log('\nAll tests completed!');
}

runTests().catch(console.error);
