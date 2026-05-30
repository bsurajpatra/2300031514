const http = require('http');
const https = require('https');
const { Log } = require('../logging_middleware/index');

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

function knapsack(capacity, items) {
  const n = items.length;
  const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];
    const weight = item.Duration;
    const value = item.Impact;

    for (let w = 0; w <= capacity; w++) {
      if (weight <= w) {
        dp[i][w] = Math.max(dp[i - 1][w], dp[i - 1][w - weight] + value);
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  const selected = [];
  let w = capacity;
  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(items[i - 1]);
      w -= items[i - 1].Duration;
    }
  }

  selected.reverse();

  return {
    maxImpact: dp[n][capacity],
    selectedItems: selected,
    totalDuration: capacity - w
  };
}

async function runScheduler() {
  try {
    await Log('backend', 'info', 'cron_job', 'Scheduler optimization started');

    const token = await getAccessToken();

    const logApiUrl = process.env.LOG_API_URL;
    if (!logApiUrl) {
      throw new Error('LOG_API_URL is not defined in env');
    }
    const origin = new URL(logApiUrl).origin;
    const depotsUrl = `${origin}/evaluation-service/depots`;
    const vehiclesUrl = `${origin}/evaluation-service/vehicles`;

    const [depotsData, vehiclesData] = await Promise.all([
      requestJson(depotsUrl, 'GET', null, token),
      requestJson(vehiclesUrl, 'GET', null, token)
    ]);

    const depots = depotsData.depots;
    const vehicles = vehiclesData.vehicles;

    console.log(`Successfully fetched ${depots.length} depots and ${vehicles.length} vehicles.`);

    for (const depot of depots) {
      const capacity = depot.MechanicHours;
      const result = knapsack(capacity, vehicles);

      console.log(`\n========================================`);
      console.log(`DEPOT ID: ${depot.ID}`);
      console.log(`Mechanic Hours Budget: ${capacity} hours`);
      console.log(`----------------------------------------`);
      console.log(`Selected Vehicles for Service:`);
      result.selectedItems.forEach(item => {
        console.log(` - Task: ${item.TaskID} | Duration: ${item.Duration} hrs | Impact: ${item.Impact}`);
      });
      console.log(`----------------------------------------`);
      console.log(`Total Scheduled Hours: ${result.totalDuration} hours`);
      console.log(`Total Operational Impact Score: ${result.maxImpact}`);
      console.log(`========================================`);

      const logMsg = `Depot ${depot.ID} optimized: Impact ${result.maxImpact}, Hours ${result.totalDuration}`;
      await Log('backend', 'info', 'cron_job', logMsg);
    }

    await Log('backend', 'info', 'cron_job', 'Scheduler optimization completed');

  } catch (err) {
    console.error('Scheduler Execution Failed:', err.message);
    await Log('backend', 'fatal', 'cron_job', `Scheduler failed: ${err.message.substring(0, 30)}`)
      .catch(e => console.error('Failed to log error:', e.message));
  }
}

runScheduler();
