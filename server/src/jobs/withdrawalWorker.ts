import { Worker, type Job } from 'bullmq';
import mongoose from 'mongoose';
import { bullConnectionOptions } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { QUEUE_NAMES } from './queues.js';
import { withdrawalRepo } from '../repositories/withdrawalRepo.js';
import { walletRepo } from '../repositories/walletRepo.js';
import { ledgerRepo } from '../repositories/ledgerRepo.js';
import { getTreasuryKeypair, isTreasuryConfigured } from '../chain/treasury.js';
import { buildTreasuryTransferTx, sendRawAndConfirm } from '../chain/splTransfer.js';
import { PublicKey } from '@solana/web3.js';
import { decimal128ToMinorUnits, minorUnitsToDecimal128, minorUnitsToDecimalString } from '../utils/money.js';
import { emitToUser } from '../realtime/socket.js';

interface WithdrawalJobData {
  withdrawalId: string;
}

async function refundWithdrawal(withdrawalId: string, reason: string) {
  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal || withdrawal.status === 'refunded' || withdrawal.status === 'confirmed') return;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const wallet = await walletRepo.findById(String(withdrawal.walletId), session);
      if (!wallet) return;
      const amountMinor = decimal128ToMinorUnits(withdrawal.amount);
      const newBalance = decimal128ToMinorUnits(wallet.custodialBalance) + amountMinor;

      const refundEntry = await ledgerRepo.append(
        {
          userId: String(withdrawal.userId),
          walletId: String(wallet._id),
          type: 'adjustment',
          amount: minorUnitsToDecimalString(amountMinor),
          balanceAfter: minorUnitsToDecimalString(newBalance),
          refType: 'manual',
          refId: withdrawalId,
          idempotencyKey: `withdrawal_refund:${withdrawalId}`,
        },
        session,
      );

      wallet.custodialBalance = minorUnitsToDecimal128(newBalance);
      await wallet.save({ session });

      await withdrawalRepo.updateById(withdrawalId, { status: 'failed', lastError: reason, refundLedgerEntryId: refundEntry._id }, session);
    });
  } finally {
    await session.endSession();
  }
  emitToUser(String(withdrawal.userId), 'wallet:balance_changed', { reason: 'withdrawal_failed_refunded' });
}

async function processWithdrawal(job: Job<WithdrawalJobData>) {
  const { withdrawalId } = job.data;
  const withdrawal = await withdrawalRepo.findById(withdrawalId, { withSignedTx: true });
  if (!withdrawal) return;
  if (['confirmed', 'refunded'].includes(withdrawal.status)) return; // already terminal, idempotent no-op

  if (!isTreasuryConfigured()) {
    logger.error({ withdrawalId }, 'Treasury not configured - cannot send withdrawal. Refunding.');
    await refundWithdrawal(withdrawalId, 'Treasury not configured in this environment');
    return;
  }

  const treasury = getTreasuryKeypair()!;

  try {
    let rawTx: Buffer;
    let signature: string;

    if (withdrawal.signedTxBase64) {
      // Retry path: resend the SAME signed transaction, never re-sign a new one.
      rawTx = Buffer.from(withdrawal.signedTxBase64, 'base64');
      signature = withdrawal.signature ?? '';
    } else {
      const amountMinor = decimal128ToMinorUnits(withdrawal.amount);
      const built = await buildTreasuryTransferTx({
        treasury,
        destination: new PublicKey(withdrawal.destinationPubkey),
        amountMinorUnits: amountMinor,
      });
      rawTx = built.rawTx;
      signature = built.signature;
      await withdrawalRepo.updateById(withdrawalId, {
        signedTxBase64: rawTx.toString('base64'),
        signature,
        status: 'processing',
      });
    }

    await withdrawalRepo.updateById(withdrawalId, { attempts: (withdrawal.attempts ?? 0) + 1 });
    await sendRawAndConfirm(rawTx);

    const wallet = await walletRepo.findById(String(withdrawal.walletId));
    if (wallet) {
      const amountMinor = decimal128ToMinorUnits(withdrawal.amount);
      wallet.lifetimeWithdrawn = minorUnitsToDecimal128(decimal128ToMinorUnits(wallet.lifetimeWithdrawn) + amountMinor);
      await wallet.save();
    }

    await withdrawalRepo.updateById(withdrawalId, { status: 'confirmed' });
    emitToUser(String(withdrawal.userId), 'wallet:balance_changed', { reason: 'withdrawal_confirmed' });
  } catch (err) {
    logger.error({ err: (err as Error).message, withdrawalId }, 'Withdrawal send failed');
    // A failed SEND (not a failed confirmation of an already-broadcast tx) is
    // recoverable via refund. We deliberately do not distinguish "definitely
    // never landed" from "unknown" here beyond retry count, per spec's
    // guidance that a failed send is recoverable and a double-send is not -
    // so on final failure we refund rather than silently retry forever.
    if ((withdrawal.attempts ?? 0) >= 4) {
      await refundWithdrawal(withdrawalId, (err as Error).message);
    } else {
      throw err; // let BullMQ retry with backoff, resending the same signed tx
    }
  }
}

export function startWithdrawalWorker(): Worker {
  const worker = new Worker<WithdrawalJobData>(QUEUE_NAMES.withdrawal, processWithdrawal, {
    ...bullConnectionOptions(),
    concurrency: 2,
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Withdrawal job failed');
  });
  return worker;
}
