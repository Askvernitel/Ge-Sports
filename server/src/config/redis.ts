import IORedis, { type Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (client) return client;
  client = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });
  client.on('error', (err) => {
    logger.error({ err: err.message }, 'Redis connection error');
  });
  client.on('connect', () => logger.info('Redis connected'));
  return client;
}

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
export function bullConnectionOptions() {
  return { connection: getRedis() };
}
