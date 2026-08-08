# Build Spec — PUBG Match Wagering Platform (Solana Devnet)

Use this as the prompt/spec for a coding agent or as your own engineering plan. Everything here targets **devnet only**. Do not point at mainnet until legal and compliance work is done.

---

## 0. Product in one paragraph

Users register, complete identity verification, connect a Phantom wallet, and purchase platform tokens. They browse or create match rooms filtered by entry fee, mode, region, and skill band. On joining, their entry fee is escrowed. The match is played in PUBG. Results are pulled from the official PUBG API, the platform takes a rake, and the remaining prize pool is distributed to winners. Balances can be withdrawn subject to verification and limits.

---

## 1. Stack

| Layer | Choice |
|---|---|
| Frontend | React (Vite), TypeScript, React Router, TanStack Query, Zustand for wallet/session state |
| Wallet | `@solana/wallet-adapter-react` + Phantom adapter, `@solana/web3.js`, `@solana/spl-token` |
| Backend | Node + Express, TypeScript |
| Database | MongoDB Atlas, Mongoose |
| Chain | Solana devnet, SPL token (9 decimals) |
| Realtime | Socket.IO for room state, match state, balance updates |
| Jobs | BullMQ + Redis for result polling, settlement, payout retries |

---

## 2. Backend architecture

Layered, strict one-way dependency: **routes → controllers → services → repositories → models**. Nothing skips a layer. Services never import Express types; repositories never import services.

```
src/
  config/            env schema (zod), db connection, solana connection, logger
  routes/            express routers only — path, middleware, controller binding
  controllers/       req/res handling, DTO validation, HTTP status mapping
  services/          all business logic, transactions, orchestration
  repositories/      mongoose queries only, return plain objects
  models/            mongoose schemas + indexes
  middleware/        auth, kycGate, rateLimit, errorHandler, requestId, idempotency
  jobs/              queue definitions, workers, schedulers
  chain/             solana helpers: transfers, ATA resolution, tx confirmation
  utils/             money math, pagination, errors, crypto helpers
  types/             shared DTOs and enums
```

**Rules to enforce:**
- Controllers are thin. If a controller has business `if` statements, move them down.
- Every service method that touches balances runs inside a MongoDB transaction (Atlas replica set supports this).
- Custom error classes (`AppError` with `code`, `httpStatus`, `publicMessage`) — the error handler is the only place that formats responses.
- Zod schemas for every request body, validated in middleware, typed through to the service.

---

## 3. Data models

### User
```
_id, email (unique, lowercase), passwordHash, emailVerifiedAt,
displayName, role: 'user'|'admin'|'support',
status: 'active'|'suspended'|'closed'|'self_excluded',
pubgAccountId, pubgPlatform: 'steam'|'kakao'|'psn'|'xbox',
pubgLinkedAt, pubgLinkVerificationToken,
createdAt, lastLoginAt, lastLoginIp
```

### KycRecord
```
userId, provider, providerRefId,
level: 'none'|'basic'|'full',
status: 'not_started'|'pending'|'approved'|'rejected'|'expired',
countryCode, dateOfBirth, documentType,
sanctionsChecked: bool, pepMatch: bool,
reviewedBy, reviewedAt, rejectionReason,
rawPayloadRef  // pointer to encrypted blob, never the raw docs in Mongo
```
Never store document images in Mongo. Store a provider reference and let the KYC vendor hold the PII.

### Wallet
```
userId (unique), custodialBalance (Decimal128), lockedBalance (Decimal128),
linkedPublicKey, linkedAt, linkSignature,
lifetimeDeposited, lifetimeWithdrawn
```
`custodialBalance` is the spendable balance; `lockedBalance` is escrowed in open rooms. Invariant: `custodialBalance >= 0` and `lockedBalance >= 0` at all times.

### LedgerEntry — the source of truth for all balances
```
_id, userId, walletId,
type: 'deposit'|'withdrawal'|'entry_fee'|'entry_refund'|'payout'|'rake'|'adjustment'|'bonus',
amount (Decimal128, signed),
balanceAfter (Decimal128),
refType: 'room'|'match'|'onchain_tx'|'manual', refId,
idempotencyKey (unique, sparse),
onchainSignature (sparse), createdAt
```
Double-entry discipline: every movement writes a ledger row, and `Wallet.custodialBalance` is a cached projection you can rebuild by summing the ledger. Add a nightly reconciliation job that recomputes and alerts on drift. This is not optional — it is how you survive your first support dispute.

### Room
```
_id, code (short human-readable), createdBy,
status: 'open'|'locked'|'in_progress'|'awaiting_results'|'settling'|'settled'|'cancelled'|'disputed',
config: {
  mode: 'solo'|'duo'|'squad',
  perspective: 'tpp'|'fpp',
  map: 'erangel'|'miramar'|'sanhok'|'vikendi'|'any',
  region: string,
  entryFee (Decimal128),
  maxPlayers, minPlayers,
  payoutStructure: 'winner_take_all'|'top3'|'placement_points',
  skillBand: { minRating, maxRating } | null,
  isPrivate: bool, passwordHash: string|null
},
prizePool (Decimal128), rakeBps (int, e.g. 500 = 5%),
scheduledStartAt, lockAt, startedAt, settledAt,
pubgMatchId, resultSource: 'pubg_api'|'manual_review'
```

### RoomEntry
```
roomId, userId, joinedAt, entryFeeCharged,
status: 'joined'|'refunded'|'no_show'|'played'|'disqualified',
placement, kills, pointsAwarded, payoutAmount
```
Unique compound index on `(roomId, userId)`.

### Match
```
roomId, pubgMatchId, fetchedAt, rawSummaryRef,
participants: [{ userId, pubgPlayerId, placement, kills, damage, timeSurvived }],
verificationStatus: 'verified'|'partial'|'failed',
discrepancies: [...]
```

### OnchainTransaction
```
userId, direction: 'deposit'|'withdrawal',
amount, tokenMint, fromPubkey, toPubkey,
signature (unique), slot, confirmationStatus,
status: 'pending'|'confirmed'|'finalized'|'failed'|'reversed',
detectedAt, confirmedAt, ledgerEntryId
```

### Indexes to create explicitly
`User.email`, `User.pubgAccountId`, `Room.status + Room.scheduledStartAt`, `RoomEntry.roomId+userId` (unique), `LedgerEntry.userId + createdAt`, `LedgerEntry.idempotencyKey` (unique sparse), `OnchainTransaction.signature` (unique).

---

## 4. Token and custody model

**Recommendation for MVP: custodial hybrid.** Full non-custodial escrow requires an on-chain Anchor program with a PDA vault, which roughly triples the scope and needs an audit before real money. Structure it so you can swap in the program later.

**Deposit flow**
1. User connects Phantom, signs a message to prove key ownership, backend verifies with `nacl.sign.detached.verify`, stores `linkedPublicKey`.
2. Backend exposes a treasury deposit address (its ATA for the SPL mint).
3. User transfers tokens; frontend submits the signature to `POST /wallet/deposits/claim`.
4. Worker fetches the transaction, verifies: correct mint, correct destination ATA, sender matches `linkedPublicKey`, signature not already consumed, confirmed at `finalized`.
5. On success, write a `deposit` ledger entry and credit `custodialBalance`. Idempotent on signature.

Also run a **backstop poller** that scans the treasury ATA for incoming transfers, so deposits still land if the user closes the tab.

**Withdrawal flow**
1. Request → validate KYC level, check limits, check no open rooms.
2. Debit balance and write ledger entry inside a Mongo transaction, marking the withdrawal `pending`.
3. Enqueue an on-chain transfer job. Use a fresh blockhash, retry with the *same* signed transaction on timeout, never re-sign a new one blindly.
4. Confirm to `finalized`, mark `confirmed`. On hard failure, write a compensating `adjustment` entry and refund.

Debit before send, never after. A failed send is a recoverable refund; a double-send is not recoverable.

**Devnet token setup**
```bash
spl-token create-token --decimals 9 --url devnet
spl-token create-account <MINT> --url devnet
spl-token mint <MINT> 1000000 --url devnet
```
Add a devnet-only faucet endpoint (`POST /dev/faucet`) so testers can get tokens without buying anything. Gate it behind `NODE_ENV !== 'production'` and a feature flag.

---

## 5. Match result verification — the critical path

This is the highest-risk component. Build it first as a spike before anything else.

- Users link their PUBG account. Verify ownership by requiring a temporary display-name suffix or by matching a recent public match the user reports — do not trust a typed-in name.
- After `lockAt`, poll `GET /shards/{platform}/players?filter[playerIds]=...` for the room's participants to find matches created after `startedAt`.
- Identify the correct match by intersecting the recent-match lists of all participants. A match ID that appears for every participant is your candidate.
- Fetch `GET /shards/{platform}/matches/{id}`, parse the participant and roster objects for placement, kills, damage, survival time.
- Respect rate limits (the API is throttled per key) — queue requests, back off on 429, cache match telemetry.
- If no match is found within a timeout window, move the room to `disputed` and refund entries. Refund is always safer than a wrong payout.

**Never accept client-reported results.** Not screenshots as a primary source, not self-reported placements. Manual review is a fallback with an admin queue, not a mechanism.

---

## 6. Settlement

Runs as a single idempotent job keyed on `roomId`, inside a Mongo transaction:

1. Load room, entries, verified match.
2. Compute `rake = prizePool * rakeBps / 10000`, `distributable = prizePool - rake`.
3. Apply `payoutStructure` to compute per-user payouts. Use integer minor units throughout — no floats anywhere in money math.
4. Assert `sum(payouts) + rake === prizePool` exactly. Fail loudly if not.
5. Write ledger entries: one `rake` to the house account, one `payout` per winner.
6. Release `lockedBalance` for all entries, credit `custodialBalance` for winners.
7. Mark room `settled`, emit socket events.

Re-running settlement on an already-settled room must be a no-op.

---

## 7. API surface

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/verify-email

GET    /me
PATCH  /me
POST   /me/pubg-account/link
POST   /me/pubg-account/verify
POST   /me/self-exclude

POST   /kyc/session          → provider session token
GET    /kyc/status
POST   /kyc/webhook          → signature-verified provider callback

POST   /wallet/link          → verify signed message from Phantom
GET    /wallet
GET    /wallet/ledger        → paginated
POST   /wallet/deposits/claim
POST   /wallet/withdrawals
GET    /wallet/withdrawals/:id

GET    /rooms                → filters: mode, perspective, map, region,
                                minFee, maxFee, status, hasSpace, skillBand
POST   /rooms
GET    /rooms/:id
POST   /rooms/:id/join
POST   /rooms/:id/leave
POST   /rooms/:id/start      → creator only

GET    /matches/:id

GET    /admin/rooms/disputed
POST   /admin/rooms/:id/resolve
GET    /admin/kyc/queue
POST   /admin/users/:id/suspend
```

Every mutating endpoint accepts an `Idempotency-Key` header. Store key → response for 24h.

---

## 8. Frontend structure

```
src/
  app/            router, providers (wallet, query, socket, auth)
  features/
    auth/         login, register, email verify
    kyc/          status stepper, provider SDK mount
    wallet/       connect, balance, deposit, withdraw, ledger table
    rooms/        browser with filter sidebar, room card, create modal, detail/lobby
    match/        live state, results table, payout breakdown
    admin/        dispute queue, KYC review
  components/     design system primitives
  hooks/          useWalletBalance, useRoom, useSocketRoom
  lib/            api client (typed), formatters, money utils
```

**Room filter sidebar:** mode, perspective, map, region, entry fee range slider, "has open slots", skill band, private/public. Filters live in URL search params so rooms are shareable.

**Wallet UX:** show three numbers distinctly — on-chain wallet balance, platform available balance, platform locked balance. Users confuse these constantly if you merge them.

---

## 9. Security and integrity

- Argon2id for passwords. JWT access token (15 min) + rotating refresh token in httpOnly cookie.
- Rate limit auth endpoints hard; rate limit room-join per user.
- **Collusion detection:** flag rooms where the same subset of users repeatedly plays together with consistent placement patterns; flag shared IPs and device fingerprints across entries in one room.
- **Multi-accounting:** one PUBG account per platform user, enforced by unique index; one verified identity per user via the KYC provider's duplicate detection.
- Deposit/withdrawal velocity limits and manual review thresholds.
- Full audit log for every admin action.
- Never log private keys, seed phrases, or KYC payloads. Treasury key in a KMS or at minimum an env-injected secret that never touches the repo.

---

## 10. Responsible-gaming features (build these into v1, not later)

Self-exclusion, deposit limits, loss limits, session-time reminders, and a visible link to support resources. These are required by every licensing regime and are far harder to retrofit than to include.

---

## 11. Build order

1. Auth + user model + email verification
2. Phantom connect and signed-message wallet linking
3. Devnet SPL mint, faucet, deposit claim, ledger, withdrawal
4. **PUBG API spike** — prove you can resolve a match result for known accounts before going further
5. Room CRUD, filters, join/leave with escrow
6. Settlement engine with an exhaustive test suite around the money math
7. Socket realtime for lobby and results
8. KYC integration
9. Admin dispute and review tooling
10. Reconciliation job, monitoring, alerting

---

## 12. Open questions to resolve before mainnet

- Confirm PUBG API tier and whether custom-match data is accessible to you.
- Read Krafton's developer and user terms on third-party wagering.
- Choose a jurisdiction; get a licensing opinion from counsel there.
- Decide custodial vs. on-chain escrow; if on-chain, budget for an audit.
- Choose a KYC/AML vendor with sanctions and PEP screening.
- Define the token's economics — is it purchasable at a fixed rate, and who provides redemption liquidity?
