import { Connection } from '@solana/web3.js';
import { env } from './env.js';

let connection: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (connection) return connection;
  connection = new Connection(env.SOLANA_RPC_URL, 'confirmed');
  return connection;
}

export const hasTreasuryConfigured = (): boolean => Boolean(env.TREASURY_SECRET_KEY);
export const hasMintConfigured = (): boolean => Boolean(env.SOLANA_TOKEN_MINT);
