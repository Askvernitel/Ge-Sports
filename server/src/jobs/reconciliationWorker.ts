import { Worker } from 'bullmq';
import { bullConnectionOptions } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { QUEUE_NAMES } from './queues.js';
import { runReconciliation } from '../services/reconciliationService.js';

async function process() {
  await runReconciliation();
}

export function startReconciliationWorker(): Worker {
  const worker = new Worker(QUEUE_NAMES.reconciliation, process, { ...bullConnectionOptions(), concurrency: 1 });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Reconciliation job failed'));
  return worker;
}
