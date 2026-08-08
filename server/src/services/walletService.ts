import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';
import { walletRepo } from '../repositories/walletRepo.js';
import { ledgerRepo } from '../repositories/ledgerRepo.js';
import { onchainTxRepo } from '../repositories/onchainTxRepo.js';
import { withdrawalRepo } from '../repositories/withdrawalRepo.js';
import { PublicKey } from '@solana/web3.js';
import { verifyWalletOwnership } from '../chain/signatureVerify.js';
import { verifyDepositTransaction } from '../chain/txVerify.js';
import { getTreasuryKeypair } from '../chain/treasury.js';
import { buildTreasuryTransferTx, sendRawAndConfirm } from '../chain/splTransfer.js';
import {
  decimal128ToMinorUnits,
  minorUnitsToDecimal128,
  minorUnitsToDecimalString,
} from '../utils/money.js';
import { parsePagination, paginationMeta } from '../utils/pagination.js';
import { getWithdrawalQueue } from '../jobs/queues.js';

export const walletService = {
  async linkWallet(userId: string, params: { publicKey: string; message: string; signatureBase58: string }) {
    const ok = verifyWalletOwnership(params);
    if (!ok) throw new AppError('VALIDATION_ERROR', 'Signature verification failed');

    const existingLink = await walletRepo.findByLinkedPublicKey(params.publicKey);
    if (existingLink && String(existingLink.userId) !== userId) {
      throw new AppError('CONFLICT', 'That wallet is already linked to another account');
    }

    const wallet = await walletRepo.findOrCreateForUser(userId);
    wallet.linkedPublicKey = params.publicKey;
    wallet.linkedAt = new Date();
    wallet.linkSignature = params.signatureBase58;
    await wallet.save();
    return wallet;
  },

  async getWallet(userId: string) {
    const wallet = await walletRepo.findOrCreateForUser(userId);
    return wallet;
  },

  async getLedger(userId: string, query: { page?: unknown; limit?: unknown }) {
    const { page, limit } = parsePagination(query);
    const { items, total } = await ledgerRepo.listForUser(userId, page, limit);
    return { items, meta: paginationMeta(page, limit, total) };
  },

  /**
   * POST /wallet/deposits/claim - spec section 4 deposit flow, steps 3-5.
   * Idempotent on signature: if we've already recorded a ledger entry for
   * this signature, return it rather than double-crediting.
   */
  async claimDeposit(userId: string, signature: string) {
    const existingLedger = await ledgerRepo.findByOnchainSignature(signature);
    if (existingLedger) return { alreadyProcessed: true, ledgerEntry: existingLedger };

    const existingTx = await onchainTxRepo.findBySignature(signature);
    if (existingTx && existingTx.status !== 'failed') {
      return { alreadyProcessed: true, onchainTransaction: existingTx };
    }

    const wallet = await walletRepo.findOrCreateForUser(userId);
    if (!wallet.linkedPublicKey) {
      throw new AppError('VALIDATION_ERROR', 'Link a wallet before claiming deposits');
    }

    const treasury = getTreasuryKeypair();
    if (!treasury) {
      throw new AppError('CHAIN_ERROR', 'Treasury is not configured in this environment - deposits cannot be verified on-chain right now');
    }

    const verified = await verifyDepositTransaction({
      signature,
      expectedSenderPubkey: wallet.linkedPublicKey,
      treasuryPubkey: treasury.publicKey.toBase58(),
    });

    const session = await mongoose.startSession();
    try {
      let result: unknown;
      await session.withTransaction(async () => {
        const freshWallet = await walletRepo.findById(String(wallet._id), session);
        if (!freshWallet) throw new AppError('NOT_FOUND', 'Wallet not found');

        const currentMinor = decimal128ToMinorUnits(freshWallet.custodialBalance);
        const newBalanceMinor = currentMinor + verified.amountMinorUnits;

        const ledgerEntry = await ledgerRepo.append(
          {
            userId,
            walletId: String(freshWallet._id),
            type: 'deposit',
            amount: minorUnitsToDecimalString(verified.amountMinorUnits),
            balanceAfter: minorUnitsToDecimalString(newBalanceMinor),
            refType: 'onchain_tx',
            refId: signature,
            idempotencyKey: `deposit:${signature}`,
            onchainSignature: signature,
          },
          session,
        );

        freshWallet.custodialBalance = minorUnitsToDecimal128(newBalanceMinor);
        freshWallet.lifetimeDeposited = minorUnitsToDecimal128(
          decimal128ToMinorUnits(freshWallet.lifetimeDeposited) + verified.amountMinorUnits,
        );
        await freshWallet.save({ session });

        const onchainTx = await onchainTxRepo.create(
          {
            userId,
            direction: 'deposit',
            amount: minorUnitsToDecimalString(verified.amountMinorUnits),
            tokenMint: verified.mint,
            fromPubkey: verified.sender,
            toPubkey: verified.destination,
            signature,
            slot: verified.slot,
            confirmationStatus: 'finalized',
            status: 'finalized',
            confirmedAt: new Date(),
            ledgerEntryId: ledgerEntry._id,
          },
          session,
        );

        result = { ledgerEntry, onchainTransaction: onchainTx, wallet: freshWallet };
      });
      return result;
    } finally {
      await session.endSession();
    }
  },

  /**
   * POST /wallet/withdrawals - debit-before-send inside a Mongo transaction,
   * then enqueue the actual on-chain send as a BullMQ job (spec section 4).
   */
  async requestWithdrawal(userId: string, params: { amount: string; destinationPubkey: string }) {
    const amountMinor = decimal128ToMinorUnits(params.amount);
    if (amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Withdrawal amount must be positive');

    const session = await mongoose.startSession();
    let withdrawalId: string;
    try {
      await session.withTransaction(async () => {
        const wallet = await walletRepo.findByUserId(userId, session);
        if (!wallet) throw new AppError('NOT_FOUND', 'Wallet not found');

        const balanceMinor = decimal128ToMinorUnits(wallet.custodialBalance);
        if (balanceMinor < amountMinor) {
          throw new AppError('INSUFFICIENT_BALANCE', 'Insufficient custodial balance for this withdrawal');
        }

        const newBalanceMinor = balanceMinor - amountMinor;
        const ledgerEntry = await ledgerRepo.append(
          {
            userId,
            walletId: String(wallet._id),
            type: 'withdrawal',
            amount: minorUnitsToDecimalString(-amountMinor),
            balanceAfter: minorUnitsToDecimalString(newBalanceMinor),
            refType: 'manual',
            idempotencyKey: `withdrawal-request:${userId}:${Date.now()}:${amountMinor}`,
          },
          session,
        );

        wallet.custodialBalance = minorUnitsToDecimal128(newBalanceMinor);
        await wallet.save({ session });

        const withdrawal = await withdrawalRepo.create(
          {
            userId,
            walletId: String(wallet._id),
            amount: params.amount,
            destinationPubkey: params.destinationPubkey,
            status: 'pending',
            ledgerEntryId: ledgerEntry._id,
          } as never,
          session,
        );
        withdrawalId = String(withdrawal._id);
      });
    } finally {
      await session.endSession();
    }

    try {
      const queue = getWithdrawalQueue();
      await queue.add(
        'process-withdrawal',
        { withdrawalId: withdrawalId! },
        { jobId: withdrawalId!, attempts: 5, backoff: { type: 'exponential', delay: 5000 } },
      );
    } catch (err) {
      logger.error({ err: (err as Error).message, withdrawalId: withdrawalId! }, 'Failed to enqueue withdrawal job - it remains pending and will be picked up by the reconciliation/retry path once Redis is reachable');
    }

    return withdrawalRepo.findById(withdrawalId!);
  },

  async getWithdrawal(userId: string, id: string) {
    const withdrawal = await withdrawalRepo.findById(id);
    if (!withdrawal || String(withdrawal.userId) !== userId) throw new AppError('NOT_FOUND', 'Withdrawal not found');
    return withdrawal;
  },

  /** Dev-only faucet: credits custodialBalance directly, no on-chain transfer. */
  async devFaucet(userId: string, amount: string) {
    if (env.NODE_ENV === 'production' || !env.FEATURE_DEV_FAUCET) {
      throw new AppError('FORBIDDEN', 'Faucet is disabled in this environment');
    }
    const amountMinor = decimal128ToMinorUnits(amount);
    if (amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Amount must be positive');

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const wallet = await walletRepo.findOrCreateForUser(userId, session);
        const newBalanceMinor = decimal128ToMinorUnits(wallet.custodialBalance) + amountMinor;
        await ledgerRepo.append(
          {
            userId,
            walletId: String(wallet._id),
            type: 'bonus',
            amount: minorUnitsToDecimalString(amountMinor),
            balanceAfter: minorUnitsToDecimalString(newBalanceMinor),
            refType: 'manual',
            idempotencyKey: `faucet:${userId}:${Date.now()}`,
          },
          session,
        );
        wallet.custodialBalance = minorUnitsToDecimal128(newBalanceMinor);
        await wallet.save({ session });
      });
    } finally {
      await session.endSession();
    }
    return walletRepo.findByUserId(userId);
  },

  /** Treasury public key + mint address, so the client knows where to send
   * a real on-chain deposit. Null fields mean chain features aren't
   * configured yet (no funded treasury / no mint) rather than an error —
   * the frontend degrades to the off-chain faucet in that case. */
  getDepositInfo() {
    const treasury = getTreasuryKeypair();
    return {
      treasuryPublicKey: treasury ? treasury.publicKey.toBase58() : null,
      mint: env.SOLANA_TOKEN_MINT || null,
    };
  },

  /**
   * Dev-only: sends REAL on-chain GESPORTS tokens from the treasury to the
   * caller's own linked wallet, so there's something to test the real
   * deposit-claim flow with. Distinct from devFaucet, which only credits
   * the off-chain custodial ledger and never touches the chain.
   */
  async chainFaucet(userId: string, amount: string) {
    if (env.NODE_ENV === 'production' || !env.FEATURE_DEV_FAUCET) {
      throw new AppError('FORBIDDEN', 'Faucet is disabled in this environment');
    }
    const treasury = getTreasuryKeypair();
    if (!treasury || !env.SOLANA_TOKEN_MINT) {
      throw new AppError('CHAIN_ERROR', 'Treasury or token mint is not configured yet');
    }
    const wallet = await walletRepo.findByUserId(userId);
    if (!wallet?.linkedPublicKey) {
      throw new AppError('VALIDATION_ERROR', 'Connect a wallet from your profile before requesting devnet tokens');
    }
    const amountMinor = decimal128ToMinorUnits(amount);
    if (amountMinor <= 0n) throw new AppError('VALIDATION_ERROR', 'Amount must be positive');

    const { rawTx } = await buildTreasuryTransferTx({
      treasury,
      destination: new PublicKey(wallet.linkedPublicKey),
      amountMinorUnits: amountMinor,
    });
    const signature = await sendRawAndConfirm(rawTx);
    return { signature };
  },
};
