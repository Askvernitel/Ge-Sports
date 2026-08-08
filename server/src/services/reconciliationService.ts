import { logger } from '../config/logger.js';
import { Wallet } from '../models/Wallet.js';
import { ledgerRepo } from '../repositories/ledgerRepo.js';
import { decimal128ToMinorUnits } from '../utils/money.js';

export interface ReconciliationResult {
  walletsChecked: number;
  driftFound: { walletId: string; userId: string; expected: string; actual: string }[];
}

/**
 * Nightly job: recompute each wallet's custodialBalance by summing its
 * ledger entries (excluding entry_fee/entry_refund/payout amounts that map
 * to lockedBalance movements handled elsewhere - custodialBalance is the sum
 * of every ledger row's `amount` for that wallet, since every balance
 * movement, in or out, is written to the ledger). Logs/alerts on drift.
 */
export async function runReconciliation(): Promise<ReconciliationResult> {
  const wallets = await Wallet.find().exec();
  const driftFound: ReconciliationResult['driftFound'] = [];

  for (const wallet of wallets) {
    const rows = await ledgerRepo.allForWalletCursor(String(wallet._id));
    const summedMinor = rows.reduce((sum, r) => sum + decimal128ToMinorUnits(r.amount as never), 0n);
    const actualMinor = decimal128ToMinorUnits(wallet.custodialBalance);

    if (summedMinor !== actualMinor) {
      driftFound.push({
        walletId: String(wallet._id),
        userId: String(wallet.userId),
        expected: summedMinor.toString(),
        actual: actualMinor.toString(),
      });
      logger.error(
        { walletId: String(wallet._id), userId: String(wallet.userId), expected: summedMinor.toString(), actual: actualMinor.toString() },
        'RECONCILIATION DRIFT DETECTED',
      );
    }
  }

  logger.info({ walletsChecked: wallets.length, driftCount: driftFound.length }, 'Reconciliation run complete');
  return { walletsChecked: wallets.length, driftFound };
}
