const { Log } = require('../../index');

function loggerMiddleware(req, res, next) {
  const method = req.method;
  const url = req.url;
  const startTime = Date.now();

  Log('backend', 'info', 'route', `Incoming request: ${method} ${url}`)
    .catch((err) => {
      console.error(`[Logging Middleware Error] Failed to send remote log: ${err.message}`);
    });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const level = statusCode >= 400 ? 'error' : 'info';
    
    Log('backend', level, 'route', `Completed request: ${method} ${url} - Status ${statusCode} (${duration}ms)`)
      .catch((err) => {
        console.error(`[Logging Middleware Error] Failed to send remote log: ${err.message}`);
      });
  });

  next();
}

module.exports = loggerMiddleware;
