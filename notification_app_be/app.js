const { Log } = require('../logging_middleware/index');

console.log('Notification Backend Application starting up...');

Log('backend', 'info', 'db', 'Establishing connection to Postgres Database...')
  .then(() => {
    Log('backend', 'info', 'db', 'Database connection successfully opened on port 5432')
      .catch((err) => console.error(`[DB Log Error] ${err.message}`));
  })
  .catch((err) => {
    Log('backend', 'fatal', 'db', `Critical database connection failure: ${err.message}`)
      .catch((e) => console.error(`[DB Log Error] ${e.message}`));
  });

function processNotificationQueue(notificationId, recipient) {
  Log('backend', 'info', 'service', `Processing notification ${notificationId} for recipient ${recipient}`)
    .catch((err) => console.error(`[Service Log Error] ${err.message}`));

  Log('backend', 'debug', 'cache', `Retrieving delivery preferences for ${recipient} from Redis`)
    .then(() => {
      Log('backend', 'info', 'service', `Notification ${notificationId} successfully delivered to ${recipient} via SMS`)
        .catch((err) => console.error(`[Service Log Error] ${err.message}`));
    })
    .catch((err) => {
      Log('backend', 'error', 'cache', `Failed to read cache for ${recipient}, falling back to db`)
        .catch((e) => console.error(`[Cache Log Error] ${e.message}`));
    });
}

setTimeout(() => {
  processNotificationQueue('notif_100234', 'user_ankit_99');
}, 1000);
