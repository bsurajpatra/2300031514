const { Log } = require('./index');

async function runTests() {
  console.log('--- Starting Logging Middleware Tests ---');
  
  if (!process.env.LOG_EMAIL) {
    console.log('LOG_EMAIL was not set. Using test credentials...');
    process.env.LOG_EMAIL = '2300031514cseelge@gmail.com';
    process.env.LOG_NAME = 'b suraj patra';
    process.env.LOG_ROLL_NO = '2300031514';
    process.env.LOG_ACCESS_CODE = 'AvrAAK';
    process.env.LOG_CLIENT_ID = 'dfe20271-97e3-4773-b98f-63d0fa85bcd3';
    process.env.LOG_CLIENT_SECRET = 'YUnKrYmfAvuChCMd';
  }

  if (!process.env.LOG_AUTH_URL) {
    process.env.LOG_AUTH_URL = 'http://4.224.186.213/evaluation-service/auth';
  }

  if (!process.env.LOG_API_URL) {
    process.env.LOG_API_URL = 'http://4.224.186.213/evaluation-service/logs';
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
    console.log('\nTest 4: Sending log with valid parameters...');
    const response = await Log('backend', 'info', 'db', 'Testing logging connection');
    console.log('✅ Test 4 Passed: Log sent successfully. Server response:', response);
    passed++;
  } catch (err) {
    console.error('❌ Test 4 Failed:', err.message || err);
    failed++;
  }

  console.log(`\n--- Test Summary: ${passed} passed, ${failed} failed ---`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
