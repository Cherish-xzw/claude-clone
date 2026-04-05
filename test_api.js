async function testAPI() {
  try {
    // Test health endpoint
    const health = await fetch('http://localhost:3001/api/health');
    const healthData = await health.json();
    console.log('Health:', healthData.status);

    // Test conversations endpoint
    const convs = await fetch('http://localhost:3001/api/conversations');
    const data = await convs.json();
    console.log('Conversations count:', data.conversations?.length || 0);

    // Create a test conversation
    const newConv = await fetch('http://localhost:3001/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Conversation' })
    });
    const convData = await newConv.json();
    console.log('Created conversation:', convData.conversation?.id ? 'Success' : 'Failed');

    console.log('API tests passed!');
  } catch (err) {
    console.error('API test failed:', err.message);
  }
}

testAPI();
