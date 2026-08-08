import { logger } from '../config/logger.js';
import { startWithdrawalWorker } from './withdrawalWorker.js';
import { startMatchVerificationWorker } from './matchVerificationWorker.js';
import { startSettlementWorker } from './settlementWorker.js';
import { startReconciliationWorker } from './reconciliationWorker.js';
import { startDepositPollerWorker } from './depositPollerWorker.js';
import { registerScheduledJobs } from './scheduler.js';

export async function startWorkers(): Promise<void> {
  try {
    startWithdrawalWorker();
    startMatchVerificationWorker();
    startSettlementWorker();
    startReconciliationWorker();
    startDepositPollerWorker();
    await registerScheduledJobs();
    logger.info('All BullMQ workers started');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to start one or more workers - continuing in degraded mode (Redis likely unavailable)');
  }
}
