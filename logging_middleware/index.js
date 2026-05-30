const http = require('http');
const https = require('https');

const ALLOWED_STACKS = new Set(['backend', 'frontend']);
const ALLOWED_LEVELS = new Set(['debug', 'info', 'warn', 'error', 'fatal']);
const ALLOWED_PACKAGES = new Set([
  'cache',
  'controller',
  'cron_job',
  'db',
  'domain',
  'handler',
  'repository',
  'route',
  'service'
]);

let cachedToken = null;

function makePostRequest(urlStr, payloadObj, headers = {}) {
  return new Promise((resolve, reject) => {
    if (!urlStr) {
      return reject(new Error('URL is not defined'));
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(urlStr);
    } catch (err) {
      return reject(new Error(`Invalid URL: ${err.message}`));
    }

    const payload = JSON.stringify(payloadObj);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers
      }
    };

    const httpClient = parsedUrl.protocol === 'https:' ? https : http;
    const req = httpClient.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: { raw: data } });
          }
        } else {
          reject({ statusCode: res.statusCode, message: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function fetchToken() {
  const authUrl = process.env.LOG_AUTH_URL;
  if (!authUrl) {
    throw new Error('LOG_AUTH_URL environment variable is not defined');
  }

  const credentials = {
    email: process.env.LOG_EMAIL,
    name: process.env.LOG_NAME,
    rollNo: process.env.LOG_ROLL_NO,
    accessCode: process.env.LOG_ACCESS_CODE,
    clientID: process.env.LOG_CLIENT_ID,
    clientSecret: process.env.LOG_CLIENT_SECRET
  };

  for (const [key, val] of Object.entries(credentials)) {
    if (!val) {
      throw new Error(`Environment variable for ${key} is not defined`);
    }
  }

  const response = await makePostRequest(authUrl, credentials);
  if (response.data && response.data.access_token) {
    cachedToken = response.data.access_token;
    return cachedToken;
  }
  throw new Error('Failed to retrieve access token from auth response');
}

async function Log(stack, level, package, message) {
  if (!ALLOWED_STACKS.has(stack)) {
    throw new Error(`Invalid stack: "${stack}". Must be one of: ${Array.from(ALLOWED_STACKS).join(', ')}`);
  }
  if (!ALLOWED_LEVELS.has(level)) {
    throw new Error(`Invalid level: "${level}". Must be one of: ${Array.from(ALLOWED_LEVELS).join(', ')}`);
  }
  if (!ALLOWED_PACKAGES.has(package)) {
    throw new Error(`Invalid package: "${package}". Must be one of: ${Array.from(ALLOWED_PACKAGES).join(', ')}`);
  }
  if (typeof message !== 'string') {
    throw new Error(`Invalid message: must be a string.`);
  }

  const cleanMessage = message.length > 48 ? message.substring(0, 45) + '...' : message;

  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${stack.toUpperCase()}] [${level.toUpperCase()}] [${package}] - ${cleanMessage}`);

  const payload = { stack, level, package, message: cleanMessage };
  const apiUrl = process.env.LOG_API_URL;

  if (!apiUrl) {
    throw new Error('LOG_API_URL environment variable is not defined');
  }

  if (!cachedToken) {
    await fetchToken();
  }

  try {
    const response = await makePostRequest(apiUrl, payload, {
      'Authorization': `Bearer ${cachedToken}`
    });
    return response.data;
  } catch (err) {
    if (err.statusCode === 401) {
      console.log('Token expired or invalid. Refreshing token...');
      await fetchToken();
      const response = await makePostRequest(apiUrl, payload, {
        'Authorization': `Bearer ${cachedToken}`
      });
      return response.data;
    }
    throw new Error(err.message || JSON.stringify(err));
  }
}

module.exports = { Log };
