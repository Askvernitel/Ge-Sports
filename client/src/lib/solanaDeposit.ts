import { PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferCheckedInstruction } from '@solana/spl-token';
import type { Connection } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';

// GESPORTS SPL token is fixed at 9 decimals, matching server/src/utils/money.ts's
// MINOR_UNIT_DECIMALS (must match — this is the on-chain mint's real decimals).
const TOKEN_DECIMALS = 9;

/**
 * Builds, signs (via the connected wallet) and sends a real SPL token
 * transfer from the user's own token account to the treasury's, for the
 * given whole-token amount. Assumes the user's associated token account
 * already holds tokens (e.g. from the chain faucet) — this only transfers,
 * it never creates or funds accounts.
 */
export async function sendDepositTransaction(params: {
  connection: Connection;
  wallet: WalletContextState;
  mint: string;
  treasuryPublicKey: string;
  amountWholeTokens: number;
}): Promise<string> {
  const { connection, wallet, mint, treasuryPublicKey, amountWholeTokens } = params;
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error('Wallet not connected');
  }

  const mintPubkey = new PublicKey(mint);
  const treasuryPubkey = new PublicKey(treasuryPublicKey);
  const sourceAta = await getAssociatedTokenAddress(mintPubkey, wallet.publicKey);
  const destAta = await getAssociatedTokenAddress(mintPubkey, treasuryPubkey);

  const amountMinorUnits = BigInt(Math.round(amountWholeTokens * 10 ** TOKEN_DECIMALS));

  const ix = createTransferCheckedInstruction(
    sourceAta,
    mintPubkey,
    destAta,
    wallet.publicKey,
    amountMinorUnits,
    TOKEN_DECIMALS,
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  const tx = new Transaction({ feePayer: wallet.publicKey, blockhash, lastValidBlockHeight }).add(ix);

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'finalized');
  return signature;
}
