import { logger } from '../config/logger.js';
import { getReconciliationQueue, getDepositPollerQueue } from './queues.js';
import { env } from '../config/env.js';

/** Registers BullMQ repeatable jobs. Safe to call multiple times (upsert semantics). */
export async function registerScheduledJobs(): Promise<void> {
  try {
    await getReconciliationQueue().add(
      'nightly-reconciliation',
      {},
      { repeat: { pattern: '0 3 * * *' }, jobId: 'nightly-reconciliation' }, // 03:00 daily
    );

    if (env.FEATURE_DEPOSIT_POLLER) {
      await getDepositPollerQueue().add(
        'poll-treasury-ata',
        {},
        { repeat: { every: 30_000 }, jobId: 'poll-treasury-ata' },
      );
    }
    logger.info('Scheduled jobs registered (reconciliation nightly, deposit poller every 30s)');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to register scheduled jobs (Redis unavailable?) - continuing without them');
  }
}
