import { Worker, type Job } from 'bullmq';
import { bullConnectionOptions } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { QUEUE_NAMES } from './queues.js';
import { settleRoom } from '../services/settlementService.js';

interface SettlementJobData {
  roomId: string;
}

async function process(job: Job<SettlementJobData>) {
  const { roomId } = job.data;
  const { noop } = await settleRoom(roomId);
  if (noop) logger.info({ roomId }, 'Settlement job was a no-op (room already settled)');
}

export function startSettlementWorker(): Worker {
  const worker = new Worker<SettlementJobData>(QUEUE_NAMES.settlement, process, {
    ...bullConnectionOptions(),
    concurrency: 2,
  });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Settlement job failed'));
  return worker;
}
