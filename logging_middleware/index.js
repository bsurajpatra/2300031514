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

function Log(stack, level, package, message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${stack.toUpperCase()}] [${level.toUpperCase()}] [${package}] - ${message}`);

  return new Promise((resolve, reject) => {
    if (!ALLOWED_STACKS.has(stack)) {
      return reject(new Error(`Invalid stack: "${stack}". Must be one of: ${Array.from(ALLOWED_STACKS).join(', ')}`));
    }
    if (!ALLOWED_LEVELS.has(level)) {
      return reject(new Error(`Invalid level: "${level}". Must be one of: ${Array.from(ALLOWED_LEVELS).join(', ')}`));
    }
    if (!ALLOWED_PACKAGES.has(package)) {
      return reject(new Error(`Invalid package: "${package}". Must be one of: ${Array.from(ALLOWED_PACKAGES).join(', ')}`));
    }
    if (typeof message !== 'string') {
      return reject(new Error(`Invalid message: must be a string.`));
    }

    const payload = JSON.stringify({ stack, level, package, message });
    
    const token = process.env.LOG_API_TOKEN || '';
    const apiUrl = process.env.LOG_API_URL || '';

    if (!apiUrl) {
      return reject(new Error('LOG_API_URL environment variable is not defined'));
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(apiUrl);
    } catch (err) {
      return reject(new Error(`Invalid LOG_API_URL: ${err.message}`));
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }
    };

    if (token) {
      options.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }

    const httpClient = parsedUrl.protocol === 'https:' ? https : http;

    const req = httpClient.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            resolve({ raw: data, statusCode: res.statusCode });
          }
        } else {
          reject(new Error(`API failed with status code ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

module.exports = { Log };
