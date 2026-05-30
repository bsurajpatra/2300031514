const http = require('http');
const https = require('https');
const { Log } = require('../logging_middleware/index');

const WEIGHTS = {
  'Placement': 3,
  'Result': 2,
  'Event': 1
};

function requestJson(urlStr, method, payloadObj = null, token = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    let payload = null;
    if (payloadObj) {
      payload = JSON.stringify(payloadObj);
      options.headers['Content-Length'] = Buffer.byteLength(payload);
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
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function getAccessToken() {
  const authUrl = process.env.LOG_AUTH_URL;
  const credentials = {
    email: process.env.LOG_EMAIL,
    name: process.env.LOG_NAME,
    rollNo: process.env.LOG_ROLL_NO,
    accessCode: process.env.LOG_ACCESS_CODE,
    clientID: process.env.LOG_CLIENT_ID,
    clientSecret: process.env.LOG_CLIENT_SECRET
  };
  const res = await requestJson(authUrl, 'POST', credentials);
  if (res && res.access_token) {
    return res.access_token;
  }
  throw new Error('Failed to retrieve access token');
}

async function runPriorityInbox() {
  try {
    await Log('backend', 'info', 'service', 'Priority inbox sorting service started');

    const token = await getAccessToken();

    const logApiUrl = process.env.LOG_API_URL;
    if (!logApiUrl) {
      throw new Error('LOG_API_URL is not defined in env');
    }
    const origin = new URL(logApiUrl).origin;
    const notificationsUrl = `${origin}/evaluation-service/notifications`;

    const response = await requestJson(notificationsUrl, 'GET', null, token);
    const notifications = response.notifications || [];

    const scored = notifications.map(item => {
      const type = item.Type || 'Event';
      const weight = WEIGHTS[type] || 0;
      
      const isoStr = item.Timestamp.replace(' ', 'T');
      const timeSec = Math.floor(new Date(isoStr).getTime() / 1000);
      
      const score = (weight * 172800) + timeSec;

      return {
        ...item,
        Weight: weight,
        UnixTime: timeSec,
        PriorityScore: score
      };
    });

    scored.sort((a, b) => b.PriorityScore - a.PriorityScore);

    const top10 = scored.slice(0, 10);

    console.log(`\n========================================`);
    console.log(`TOP 10 PRIORITY INBOX NOTIFICATIONS`);
    console.log(`========================================`);
    top10.forEach((item, idx) => {
      console.log(`${idx + 1}. [${item.Type.toUpperCase()}] - Score: ${item.PriorityScore}`);
      console.log(`   Message: ${item.Message}`);
      console.log(`   Time:    ${item.Timestamp}`);
      console.log(`   ID:      ${item.ID}`);
      console.log(`----------------------------------------`);
    });
    console.log(`Total Unread Evaluated: ${notifications.length} notifications`);
    console.log(`========================================\n`);

    await Log('backend', 'info', 'service', 'Priority inbox generated successfully');

  } catch (err) {
    console.error('Priority Inbox Execution Failed:', err.message);
    await Log('backend', 'error', 'service', `Priority Inbox failed: ${err.message.substring(0, 30)}`)
      .catch(e => console.error('Failed to log error:', e.message));
  }
}

runPriorityInbox();
