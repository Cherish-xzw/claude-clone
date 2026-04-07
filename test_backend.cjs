const http = require('http');

const PORT = 3099;
console.log('Testing backend API on port ' + PORT + '...\n');

// Test 1: Health check
http.get(`http://localhost:${PORT}/api/health`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('1. Health check:');
    console.log('   Status:', res.statusCode);

    // Test 2: Sessions list
    const req2 = http.request({
      hostname: 'localhost',
      port: PORT,
      path: '/api/sessions',
      method: 'GET'
    }, (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        console.log('\n2. Sessions list:');
        console.log('   Status:', res2.statusCode);
        try {
          const parsed = JSON.parse(data2);
          console.log('   Sessions count:', parsed.sessions?.length || 0);
        } catch (e) {
          console.log('   Response:', data2.substring(0, 200));
        }

        // Test 3: Session status
        const req3 = http.request({
          hostname: 'localhost',
          port: PORT,
          path: '/api/session-status',
          method: 'GET'
        }, (res3) => {
          let data3 = '';
          res3.on('data', chunk => data3 += chunk);
          res3.on('end', () => {
            console.log('\n3. Session status:');
            console.log('   Status:', res3.statusCode);
            try {
              const parsed = JSON.parse(data3);
              console.log('   isValid:', parsed.isValid);
              console.log('   timeRemaining:', parsed.timeRemaining);
              console.log('   expiresAt:', parsed.expiresAt ? 'present' : 'missing');
              console.log('   needsWarning:', parsed.needsWarning);
            } catch (e) {
              console.log('   Response:', data3.substring(0, 200));
            }

            // Test 4: Session heartbeat
            const req4 = http.request({
              hostname: 'localhost',
              port: PORT,
              path: '/api/session-heartbeat',
              method: 'POST',
              headers: { 'Content-Length': '0' }
            }, (res4) => {
              let data4 = '';
              res4.on('data', chunk => data4 += chunk);
              res4.on('end', () => {
                console.log('\n4. Session heartbeat:');
                console.log('   Status:', res4.statusCode);
                try {
                  const parsed = JSON.parse(data4);
                  console.log('   success:', parsed.success);
                  console.log('   expiresAt:', parsed.expiresAt ? 'present' : 'missing');
                } catch (e) {
                  console.log('   Response:', data4.substring(0, 200));
                }
                console.log('\n=== All backend tests completed ===');
              });
            });
            req4.on('error', console.error);
            req4.end();
          });
        });
        req3.on('error', console.error);
        req3.end();
      });
    });
    req2.on('error', console.error);
    req2.end();
  });
}).on('error', console.error);
