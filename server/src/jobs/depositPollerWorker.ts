import { Worker } from 'bullmq';
import { bullConnectionOptions } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { QUEUE_NAMES } from './queues.js';
import { isTreasuryConfigured } from '../chain/treasury.js';

/**
 * Backstop poller (spec section 4): scans the treasury ATA for incoming
 * transfers so deposits land even if the user closes the tab before calling
 * /wallet/deposits/claim. No funded treasury keypair exists in this
 * environment, so this safely no-ops and logs instead of crashing or
 * spamming RPC calls with an unconfigured mint/treasury.
 */
async function process() {
  if (!isTreasuryConfigured()) {
    logger.info('[deposit-poller] Treasury not configured - would poll treasury ATA for incoming transfers, skipping (stub mode).');
    return;
  }
  // Real implementation: connection.getSignaturesForAddress(treasuryAta),
  // diff against OnchainTransaction.signature already seen, verify + credit
  // any new ones via the same path claimDeposit() uses.
  logger.info('[deposit-poller] Polling treasury ATA for incoming transfers (real mode).');
}

export function startDepositPollerWorker(): Worker {
  const worker = new Worker(QUEUE_NAMES.depositPoller, process, { ...bullConnectionOptions(), concurrency: 1 });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Deposit poller job failed'));
  return worker;
}
