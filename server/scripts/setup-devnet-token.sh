#!/usr/bin/env bash
# One-time devnet setup: creates the GESPORTS SPL token mint, mints an
# initial supply into the treasury's own token account, and prints the
# SOLANA_TOKEN_MINT value to paste into server/.env.
#
# Prerequisites: the treasury keypair at server/.secrets/treasury.json must
# already hold devnet SOL for fees/rent (run `solana airdrop 2 <pubkey>
# --url devnet`, or have someone send devnet SOL to it — the devnet faucet
# is IP-rate-limited and may reject repeated requests from the same host).
#
# Usage: cd server && ./scripts/setup-devnet-token.sh
set -euo pipefail

cd "$(dirname "$0")/.."
KEYPAIR="$(pwd)/.secrets/treasury.json"

if [ ! -f "$KEYPAIR" ]; then
  echo "Missing $KEYPAIR — run: solana-keygen new --no-bip39-passphrase -o $KEYPAIR"
  exit 1
fi

# Treasury becomes the default signer/fee-payer/mint-authority for every
# command below, so no per-command --fee-payer/--mint-authority flags needed.
solana config set --url https://api.devnet.solana.com --keypair "$KEYPAIR" >/dev/null

TREASURY_PUBKEY=$(solana address)
echo "Treasury: $TREASURY_PUBKEY"
echo "Balance: $(solana balance)"

echo "Creating SPL token mint (9 decimals)..."
CREATE_OUT=$(spl-token create-token --decimals 9)
echo "$CREATE_OUT"
MINT=$(echo "$CREATE_OUT" | grep -oE 'Address:  [1-9A-HJ-NP-Za-km-z]{32,44}' | awk '{print $2}')

if [ -z "$MINT" ]; then
  echo "Could not parse mint address from create-token output above."
  exit 1
fi

echo "Creating treasury's associated token account for $MINT..."
spl-token create-account "$MINT"

echo "Minting 1,000,000 GESPORTS into the treasury account..."
spl-token mint "$MINT" 1000000

echo ""
echo "Done. Mint address: $MINT"
echo "Add this to server/.env: SOLANA_TOKEN_MINT=$MINT"
