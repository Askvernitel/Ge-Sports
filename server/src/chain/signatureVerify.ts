import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';

/**
 * Verifies a Phantom `signMessage` signature proves ownership of `publicKey`.
 * `message` is the plaintext challenge the frontend had the user sign;
 * `signatureBase58` is the resulting signature, base58-encoded (Phantom's
 * convention). Returns true only if the signature is valid for that exact
 * message and public key.
 */
export function verifyWalletOwnership(params: { publicKey: string; message: string; signatureBase58: string }): boolean {
  try {
    const pubkeyBytes = new PublicKey(params.publicKey).toBytes();
    const signatureBytes = bs58.decode(params.signatureBase58);
    const messageBytes = new TextEncoder().encode(params.message);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
  } catch {
    return false;
  }
}
