import { PublicKey } from '@solana/web3.js';
import { getSolanaConnection } from '../config/solana.js';
import { requireMint, resolveAta } from './splTransfer.js';

export interface VerifiedDeposit {
  amountMinorUnits: bigint;
  sender: string;
  destination: string;
  mint: string;
  slot: number;
  finalized: boolean;
}

/**
 * Fetches a transaction by signature and verifies it is a valid deposit per
 * spec section 4: correct mint, correct destination ATA (treasury's), sender
 * matches the claimed linked public key, and it is finalized. Does NOT check
 * "not already consumed" - that's a ledger/idempotency-key concern the
 * caller (walletService) handles via the unique onchainSignature index.
 */
export async function verifyDepositTransaction(params: {
  signature: string;
  expectedSenderPubkey: string;
  treasuryPubkey: string;
}): Promise<VerifiedDeposit> {
  const connection = getSolanaConnection();
  const mint = requireMint();
  const treasuryAta = await resolveAta(new PublicKey(params.treasuryPubkey), mint);

  const tx = await connection.getParsedTransaction(params.signature, {
    commitment: 'finalized',
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) throw new Error('Transaction not found or not yet finalized');
  if (tx.meta?.err) throw new Error('Transaction failed on-chain');

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  const destPost = postBalances.find((b) => b.owner === params.treasuryPubkey && b.mint === mint.toBase58());
  const destPre = preBalances.find((b) => b.accountIndex === destPost?.accountIndex);
  if (!destPost) throw new Error('No token balance change found for treasury ATA in this transaction');

  const postAmount = BigInt(destPost.uiTokenAmount.amount);
  const preAmount = BigInt(destPre?.uiTokenAmount.amount ?? '0');
  const delta = postAmount - preAmount;
  if (delta <= 0n) throw new Error('Transaction did not increase treasury ATA balance');

  const accountKeys = tx.transaction.message.accountKeys.map((k) => k.pubkey.toBase58());
  const senderIsSigner = accountKeys.some((key, idx) => key === params.expectedSenderPubkey && tx.transaction.message.accountKeys[idx]?.signer);
  if (!senderIsSigner) throw new Error('Claimed sender did not sign this transaction');

  return {
    amountMinorUnits: delta,
    sender: params.expectedSenderPubkey,
    destination: treasuryAta.toBase58(),
    mint: mint.toBase58(),
    slot: tx.slot,
    finalized: true,
  };
}
