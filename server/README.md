# PUBG Wager Platform — Backend

Devnet-only backend for the match wagering platform described in
`../pubg-wager-platform-spec.md`. Layered architecture: `routes -> controllers
-> services -> repositories -> models`, one-way dependency, per spec section 2.

## Install

```bash
cd server
npm install
```

## Run Mongo + Redis

Mongoose transactions (used for every balance-touching write) require a
**replica set**, even a single-node one. No `mongod` binary is assumed to be
installed locally, so use Docker:

```bash
docker run -d --name gesports-mongo -p 27017:27017 mongo:7 --replSet rs0
docker exec -it gesports-mongo mongosh --eval "rs.initiate()"

docker run -d --name gesports-redis -p 6379:6379 redis:7
```

(If you have a local `mongod`, start it with `--replSet rs0` and run
`rs.initiate()` once via `mongosh` instead.)

## Configure

```bash
cp .env.example .env
```

Every variable has a working default (see `src/config/env.ts`), so the
server **boots even with an empty `.env`** — see "Degraded/stub mode" below.

## Run

```bash
npm run dev        # tsx watch, ts-node-style hot reload
npm run build       # tsc -> dist/
npm start           # node dist/index.js
```

## Test

```bash
npm test            # vitest run — settlement money-math + unit tests
npm run typecheck   # tsc --noEmit
```

`test/money.test.ts` and `test/settlement.test.ts` are the highest-scrutiny
suite: exact integer division, remainder handling (e.g. a 550 minor-unit pool
split among 3 winners), the `sum(payouts) + rake === prizePool` invariant
(including a fuzz test across many pool sizes with an awkward rake bps), and
rejection of unknown payout structures. All money math is done in `bigint`
"minor units" (`src/utils/money.ts`) — floats never touch a balance.

## Boot behavior without real infra (degraded mode, not fail-fast)

This backend is built to **boot and stay up** even when Mongo/Redis/PUBG/
Solana credentials are missing or unreachable, rather than crash-looping:

- `src/config/mongo.ts` — `mongoose.connect()` is fired without blocking
  server startup; on failure it retries in the background every 5s.
  Mongoose buffers queries by default, so requests issued before a
  connection exists simply wait rather than throwing immediately.
- `src/config/redis.ts` / `src/config/redis.ts` — ioredis is configured with
  a `retryStrategy` so a missing Redis doesn't throw on startup; BullMQ
  workers/queues fail their individual operations but don't crash the
  process (`jobs/index.ts` and `jobs/scheduler.ts` catch and log).
- `src/chain/treasury.ts` — with no `TREASURY_SECRET_KEY`, treasury-dependent
  features (deposit verification, withdrawal sending) return a clean
  `CHAIN_ERROR`/refund instead of throwing at import time.
- `src/services/pubg/index.ts` — with no `PUBG_API_KEY`, falls back to
  `MockPubgProvider` automatically.

So: `npm run dev` with a totally empty environment will start listening on
`PORT` and answer `GET /health` immediately; endpoints that need Mongo will
hang/wait until Mongo is reachable rather than 500ing forever.

## What's real vs. stubbed

| Piece | Status | Real implementation lives at | Switch by |
|---|---|---|---|
| Auth (argon2id, JWT access+refresh) | **Real** | `src/services/authService.ts` | n/a |
| Wallet linking (nacl signature verify) | **Real** | `src/chain/signatureVerify.ts` | n/a |
| Ledger / double-entry bookkeeping | **Real** | `src/services/walletService.ts`, `src/services/settlementService.ts` | n/a |
| Settlement money math | **Real**, unit-tested | `src/utils/money.ts`, `src/services/settlementService.ts` | n/a |
| Room escrow (join/leave/start) | **Real** | `src/services/roomService.ts` | n/a |
| Reconciliation job | **Real** | `src/services/reconciliationService.ts` | n/a |
| Idempotency middleware | **Real** (Mongo-backed, 24h TTL index) | `src/middleware/idempotency.ts` | n/a |
| **PUBG match API** | **Stubbed** (`MockPubgProvider`) | `src/services/pubg/HttpPubgProvider.ts` (real) vs `MockPubgProvider.ts` (fake, deterministic) | set `PUBG_API_KEY` — `src/services/pubg/index.ts` picks the real provider automatically |
| **KYC vendor** | **Stubbed** (`MockKycProvider`, auto-approves) | `src/services/kyc/KycProvider.ts` interface | swap the provider constructed in `src/services/kyc/index.ts` for a real vendor SDK client (Persona/Onfido/Sumsub/etc); no env flag exists yet because no vendor is integrated |
| **Solana treasury / on-chain transfers** | **Stubbed** (no funded devnet keypair) | `src/chain/treasury.ts`, `src/chain/splTransfer.ts`, `src/chain/txVerify.ts` | set `TREASURY_SECRET_KEY` (JSON byte array, e.g. from `solana-keygen`) and `SOLANA_TOKEN_MINT` |
| **Deposit backstop poller** | **Stub** (logs "would poll", no-ops without a treasury) | `src/jobs/depositPollerWorker.ts` | same as treasury above |
| Email sending | **Stubbed** (logs the token instead of sending) | `src/services/emailService.ts` | implement `EmailService` with a real provider (SES/Postmark/etc) and swap the export |

### PUBG account ownership verification

Implemented per spec section 5's "temporary display-name suffix" approach
(no live API key needed to build against): `POST /me/pubg-account/link`
issues a random 3-character suffix the user must append to their in-game
name; `POST /me/pubg-account/verify` calls
`pubgProvider.getCurrentDisplayName()` and checks the suffix is present. The
real API call this would make is `GET /shards/{platform}/players/{id}`
(implemented in `HttpPubgProvider`, just untested against a live key).

### Match result verification algorithm

`src/services/matchService.ts` implements spec section 5's core algorithm:
poll each participant's recent matches, intersect the sets to find the
shared match ID, fetch full match detail, parse placement/kills/damage/
survival time. If no common match is found (or stats can't be matched for
every verified participant), the room moves to `disputed` and every `joined`
entry is refunded inside a Mongo transaction — it never guesses a result.

## Deviations from spec / judgment calls

- **kycGate thresholds**: spec doesn't pin exact levels required per action.
  This implementation requires KYC level `'basic'` to join a paid room and
  `'full'` to withdraw (`src/middleware/kycGate.ts`) — called out as a
  judgment call in the spec's own wording.
- **House account for rake**: the spec doesn't define a literal house
  `User`/`Wallet` document. Rake ledger entries are written against a
  well-known sentinel ObjectId (`HOUSE_USER_ID`/`HOUSE_WALLET_ID` in
  `settlementService.ts`) rather than a real seeded account, to keep the
  settlement engine's unit tests DB-free. A real deployment should seed an
  actual house `User`+`Wallet` and swap the constant for its `_id`.
  Reconciliation (`reconciliationService.ts`) only iterates real `Wallet`
  documents, so this sentinel doesn't currently get reconciled — flagged
  here rather than silently glossed over.
- **`top3` weighting**: spec says "apply payoutStructure" without pinning
  exact weights. Implemented as 3:2:1 shares for 1st/2nd/3rd
  (`computePayouts` in `settlementService.ts`).
- **`placement_points` weighting**: implemented as
  `weight = fieldSize + 1 - placement` (so last place still earns something,
  first place earns the most) — again not pinned by the spec, documented
  here as the concrete rule.
- **Refund remainder distribution**: when a pool doesn't divide evenly among
  winners, the leftover minor units go to the best-placed winners first
  (largest-remainder method, ties broken by rank) — deterministic and
  auditable, per `splitByWeights` in `src/utils/money.ts`.
- **Withdrawal retry semantics**: the signed transaction bytes are persisted
  (`Withdrawal.signedTxBase64`) so a BullMQ retry resends the exact same
  signed tx rather than re-signing, per spec section 4. After repeated send
  failures (not confirmation failures of an already-broadcast tx) the job
  refunds via a compensating `adjustment` ledger entry.
- **PUBG API rate limiting**: `HttpPubgProvider` does exponential backoff on
  HTTP 429 (up to 5 attempts, capped at 15s) rather than a queue-based
  limiter, since there's no live key to tune real limits against.

## Explicit indexes

Per spec section 3: `User.email` (unique), `User.pubgAccountId+pubgPlatform`
(unique, sparse), `Room.status+scheduledStartAt`, `Room.code` (unique),
`RoomEntry.roomId+userId` (unique), `LedgerEntry.userId+createdAt`,
`LedgerEntry.idempotencyKey` (unique, sparse), `OnchainTransaction.signature`
(unique). See each model file in `src/models/` for the full index list
(a few extras were added for admin/list queries, e.g. `Room` config filters
and `KycRecord.status`).

## Security notes

- Passwords hashed with argon2id; JWT access tokens expire in 15 minutes;
  refresh tokens rotate on every use (family+version tracked on `User`,
  reuse of a stale token revokes the whole family).
- `src/config/logger.ts` redacts `password`, `passwordHash`, `secretKey`,
  `privateKey`, `seedPhrase`, `rawPayload`, and auth headers/cookies from all
  log output.
- `KycRecord` never stores document images/PII in Mongo — only a
  `providerRefId` pointer, per spec.
- The KYC webhook and every mutating route accept auth via Bearer JWT; the
  KYC webhook specifically checks a constant-time comparison against
  `KYC_SHARED_SECRET` instead of JWT, since it's meant to be called by an
  external vendor.
