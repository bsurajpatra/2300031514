const { Log } = require('./index');

async function runTests() {
  console.log('--- Starting Logging Middleware Tests ---');
  
  if (!process.env.LOG_API_TOKEN) {
    process.env.LOG_API_TOKEN = 'test_dummy_token_2300031514';
    console.log('LOG_API_TOKEN was not set. Using dummy token:', process.env.LOG_API_TOKEN);
  }

  if (!process.env.LOG_API_URL) {
    process.env.LOG_API_URL = 'http://4.224.186.213/evaluation-service/logs';
    console.log('LOG_API_URL was not set. Using test server:', process.env.LOG_API_URL);
  }

  let passed = 0;
  let failed = 0;

  try {
    console.log('\nTest 1: Validating invalid stack...');
    await Log('invalid-stack', 'info', 'db', 'Test message');
    console.error('❌ Test 1 Failed: Expected validation error for invalid-stack');
    failed++;
  } catch (err) {
    console.log('✅ Test 1 Passed: Caught expected error:', err.message);
    passed++;
  }

  try {
    console.log('\nTest 2: Validating invalid level...');
    await Log('backend', 'invalid-level', 'db', 'Test message');
    console.error('❌ Test 2 Failed: Expected validation error for invalid-level');
    failed++;
  } catch (err) {
    console.log('✅ Test 2 Passed: Caught expected error:', err.message);
    passed++;
  }

  try {
    console.log('\nTest 3: Validating invalid package...');
    await Log('backend', 'info', 'invalid-package', 'Test message');
    console.error('❌ Test 3 Failed: Expected validation error for invalid-package');
    failed++;
  } catch (err) {
    console.log('✅ Test 3 Passed: Caught expected error:', err.message);
    passed++;
  }

  try {
    console.log('\nTest 4: Sending log with valid parameters (should reach the server)...');
    const response = await Log('backend', 'info', 'db', 'Testing logging connection from middleware package');
    console.log('✅ Test 4 Passed: Log sent successfully. Server response:', response);
    passed++;
  } catch (err) {
    if (err.message.includes('status code 401') || err.message.includes('authorization') || err.message.includes('Invalid authorization')) {
      console.log('✅ Test 4 Passed: Connection established, but server returned auth error (expected with dummy token):', err.message);
      passed++;
    } else {
      console.error('❌ Test 4 Failed: Network or unknown error occurred:', err.message);
      failed++;
    }
  }

  console.log(`\n--- Test Summary: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
