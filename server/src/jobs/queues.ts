import { Queue } from 'bullmq';
import { bullConnectionOptions } from '../config/redis.js';

export const QUEUE_NAMES = {
  withdrawal: 'withdrawal-processing',
  matchVerification: 'match-verification',
  settlement: 'room-settlement',
  reconciliation: 'wallet-reconciliation',
  depositPoller: 'deposit-poller',
} as const;

let withdrawalQueue: Queue | null = null;
let matchVerificationQueue: Queue | null = null;
let settlementQueue: Queue | null = null;
let reconciliationQueue: Queue | null = null;
let depositPollerQueue: Queue | null = null;

export function getWithdrawalQueue(): Queue {
  if (!withdrawalQueue) withdrawalQueue = new Queue(QUEUE_NAMES.withdrawal, bullConnectionOptions());
  return withdrawalQueue;
}

export function getMatchVerificationQueue(): Queue {
  if (!matchVerificationQueue) matchVerificationQueue = new Queue(QUEUE_NAMES.matchVerification, bullConnectionOptions());
  return matchVerificationQueue;
}

export function getSettlementQueue(): Queue {
  if (!settlementQueue) settlementQueue = new Queue(QUEUE_NAMES.settlement, bullConnectionOptions());
  return settlementQueue;
}

export function getReconciliationQueue(): Queue {
  if (!reconciliationQueue) reconciliationQueue = new Queue(QUEUE_NAMES.reconciliation, bullConnectionOptions());
  return reconciliationQueue;
}

export function getDepositPollerQueue(): Queue {
  if (!depositPollerQueue) depositPollerQueue = new Queue(QUEUE_NAMES.depositPoller, bullConnectionOptions());
  return depositPollerQueue;
}
