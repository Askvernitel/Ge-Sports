import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

let connecting: Promise<void> | null = null;

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Connect to Mongo without blocking server boot. Mongoose buffers commands by
 * default, so requests made before the connection is ready will simply wait
 * (up to bufferTimeoutMS) rather than crash the process. This lets the API
 * boot in a "degraded" mode when no local Mongo/replica-set is available,
 * per the assignment's fail-soft requirement.
 */
export async function connectMongo(): Promise<void> {
  if (connecting) return connecting;

  mongoose.set('strictQuery', true);

  connecting = mongoose
    .connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    .then(() => {
      logger.info('MongoDB connected');
    })
    .catch((err) => {
      logger.error({ err }, 'MongoDB initial connection failed - will keep retrying in background');
      // Retry loop instead of crashing the process.
      scheduleReconnect();
    });

  return connecting;
}

function scheduleReconnect() {
  setTimeout(() => {
    mongoose
      .connect(env.MONGO_URI, { serverSelectionTimeoutMS: 5000 })
      .then(() => logger.info('MongoDB connected (retry)'))
      .catch((err) => {
        logger.error({ err: err.message }, 'MongoDB reconnect attempt failed');
        scheduleReconnect();
      });
  }, 5000);
}

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});
