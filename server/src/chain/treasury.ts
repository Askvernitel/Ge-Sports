import { Keypair } from '@solana/web3.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let cachedKeypair: Keypair | null | undefined;

/**
 * Loads the treasury keypair from TREASURY_SECRET_KEY (JSON array of bytes,
 * the format `solana-keygen` writes). Returns null (never throws) when unset
 * so callers can degrade gracefully instead of crashing the process - no
 * funded devnet keypair exists in this environment.
 */
export function getTreasuryKeypair(): Keypair | null {
  if (cachedKeypair !== undefined) return cachedKeypair;
  if (!env.TREASURY_SECRET_KEY) {
    cachedKeypair = null;
    return null;
  }
  try {
    const bytes = Uint8Array.from(JSON.parse(env.TREASURY_SECRET_KEY) as number[]);
    cachedKeypair = Keypair.fromSecretKey(bytes);
    // Never log the secret itself.
    logger.info({ publicKey: cachedKeypair.publicKey.toBase58() }, 'Treasury keypair loaded');
  } catch (err) {
    logger.error({ err: (err as Error).message }, 'Failed to parse TREASURY_SECRET_KEY - treasury features disabled');
    cachedKeypair = null;
  }
  return cachedKeypair;
}

export function isTreasuryConfigured(): boolean {
  return getTreasuryKeypair() !== null;
}
