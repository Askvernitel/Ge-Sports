import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferCheckedInstruction,
} from '@solana/spl-token';
import { PublicKey, Transaction, type Keypair, sendAndConfirmRawTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getSolanaConnection } from '../config/solana.js';
import { env } from '../config/env.js';
import { MINOR_UNIT_DECIMALS } from '../utils/money.js';

export function requireMint(): PublicKey {
  if (!env.SOLANA_TOKEN_MINT) {
    throw new Error('SOLANA_TOKEN_MINT is not configured');
  }
  return new PublicKey(env.SOLANA_TOKEN_MINT);
}

export async function resolveAta(owner: PublicKey, mint: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(mint, owner);
}

/**
 * Sends SPL tokens from the treasury to a destination pubkey. Builds a fresh
 * transaction, signs it once, and returns the raw signed bytes so the caller
 * (withdrawal job) can persist them and RETRY THE SAME SIGNED TX on timeout
 * rather than constructing + signing a new one, per spec section 4.
 */
export async function buildTreasuryTransferTx(params: {
  treasury: Keypair;
  destination: PublicKey;
  amountMinorUnits: bigint;
}): Promise<{ rawTx: Buffer; signature: string }> {
  const connection = getSolanaConnection();
  const mint = requireMint();

  const sourceAta = await getOrCreateAssociatedTokenAccount(connection, params.treasury, mint, params.treasury.publicKey);
  const destAta = await getOrCreateAssociatedTokenAccount(connection, params.treasury, mint, params.destination);

  const ix = createTransferCheckedInstruction(
    sourceAta.address,
    mint,
    destAta.address,
    params.treasury.publicKey,
    params.amountMinorUnits,
    MINOR_UNIT_DECIMALS,
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  const tx = new Transaction({ feePayer: params.treasury.publicKey, blockhash, lastValidBlockHeight }).add(ix);
  tx.sign(params.treasury);

  const rawTx = tx.serialize();
  const sigBytes = tx.signatures[0]?.signature;
  const signature = sigBytes ? bs58.encode(sigBytes) : '';
  return { rawTx, signature };
}

export async function sendRawAndConfirm(rawTx: Buffer): Promise<string> {
  const connection = getSolanaConnection();
  return sendAndConfirmRawTransaction(connection, rawTx, { commitment: 'finalized' });
}
