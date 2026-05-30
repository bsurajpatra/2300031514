const { Log } = require('../logging_middleware/index');

console.log('Vehicle Maintenance Scheduler active...');

Log('backend', 'info', 'cron_job', 'Vehicle maintenance scheduler service started')
  .then((res) => console.log('Remote startup log sent:', res))
  .catch((err) => console.error('Remote startup log failed:', err.message));

function checkMaintenanceTasks() {
  Log('backend', 'debug', 'cron_job', 'Running recurring check for vehicles due for maintenance')
    .then((res) => console.log('Remote check log sent:', res))
    .catch((err) => console.error('Remote check log failed:', err.message));
}

checkMaintenanceTasks();
const interval = setInterval(checkMaintenanceTasks, 60000);

process.on('SIGINT', () => {
  clearInterval(interval);
  Log('backend', 'info', 'cron_job', 'Vehicle maintenance scheduler service shutting down')
    .catch((err) => console.error(err.message))
    .finally(() => process.exit(0));
});
