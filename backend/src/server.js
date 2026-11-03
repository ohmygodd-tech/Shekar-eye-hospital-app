import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { pool, query } from './db/index.js';
import { startJobs } from './services/jobs.js';

await migrate();
const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`Shekar Eye Hospital API listening on :${config.port} (${config.env}, payments: ${config.payments.provider})`);
});
startJobs();

const shutdown = () => server.close(() => pool.end().then(() => process.exit(0)));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
export { query };
