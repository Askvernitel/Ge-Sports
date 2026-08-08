import { createServer } from 'node:http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectMongo } from './config/mongo.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';
import { startWorkers } from './jobs/index.js';

async function main(): Promise<void> {
  // Fire-and-forget: connectMongo retries in the background rather than
  // blocking/crashing boot, so the API comes up in degraded mode without a
  // reachable Mongo (requests that need the DB will simply wait/fail until
  // it connects; this satisfies the "boot without crashing" requirement).
  void connectMongo();

  const app = createApp();
  const httpServer = createServer(app);
  initSocket(httpServer);

  // Also fire-and-forget: BullMQ/Redis workers degrade the same way.
  void startWorkers();

  httpServer.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT} (env: ${env.NODE_ENV})`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down');
    httpServer.close(() => process.exit(0));
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup', err);
  process.exit(1);
});
