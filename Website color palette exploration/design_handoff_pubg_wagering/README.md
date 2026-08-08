# Handoff: PUBG Match Wagering Platform

## Overview

A platform where PUBG players stake tokens on their own match performance. Players browse rooms filtered by mode, map, region and entry fee, join by escrowing an entry fee, play the match in game, and the prize pool is distributed automatically from verified match results.

Everything runs on **Solana devnet with test tokens**. Nothing in the interface may imply real money is at stake, and no copy may promise winnings or returns.

Audience: competitive PUBG players, 18–35, comfortable with dense information. They read stat sheets. Do not condescend with oversized friendly cards.

## About the Design Files

The `.dc.html` files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy directly. They use a streaming component runtime (`support.js`) that is specific to the design tool; do not port that runtime.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established patterns, component library and styling approach. If no environment exists yet, choose the most appropriate framework and implement the designs there.

Each file's structure: markup lives between `<x-dc>` and `</x-dc>`; the data behind repeated rows/cards lives in the `<script data-dc-script>` class at the bottom (`renderVals()` returns the arrays). `<sc-for list="{{ x }}" as="y">` is a loop; `{{ y.field }}` is an interpolation.

## Fidelity

**High fidelity.** Final colours, typography, spacing and copy. Recreate pixel-accurately using the codebase's own primitives. All values in this document are exact.

## Design Tokens

Six colours, each with a defined job. **Do not introduce a seventh.**

| Token | Hex | Job |
|---|---|---|
| `ground` | `#171310` | Page background — a black with warm sand in it, not neutral or navy |
| `panel` | `#221D17` | Raised surfaces, cards, table rows, rails |
| `bone` | `#E0D6C2` | Primary text and rules — warm off-white, never pure `#FFF` |
| `lichen` | `#A2957A` | Secondary text, labels, disabled states, hairline rules |
| `flare` | `#C13B2A` | **Live and at-risk only** — matches in progress, losses, destructive actions, errors |
| `zone` | `#3E7CA3` | **Timing and escrow only** — countdowns, locked funds, the zone ring, focus rings |

The two accents carry meaning and must never be used decoratively. `flare` means something is live or going wrong. `zone` means a clock is running or money is held. `lichen` was lifted from `#8C7F63` to `#A2957A` specifically to clear WCAG AA (4.5:1) for small text on `panel` — it measures ≈5.6:1. Do not darken it back.

Page background also carries a barely perceptible grid texture:

```css
background-image:
  repeating-linear-gradient(0deg,  transparent 0 38px, rgba(216,211,196,0.03) 38px 39px),
  repeating-linear-gradient(90deg, transparent 0 38px, rgba(216,211,196,0.03) 38px 39px);
```

### Typography

- **Display — Big Shoulders Display** (700 / 900). Room codes, prize pool figures, page headings, countdown numerals, section labels. Uppercase with 1–2px letter-spacing on short labels.
- **Body — IBM Plex Sans** (400 / 600). All prose, form labels, buttons.
- **Data — IBM Plex Mono** (400 / 500) with `font-variant-numeric: tabular-nums`. Every token amount, match ID, coordinate, timestamp, K/D figure, countdown, and every small uppercase label in the chrome.

The mono/sans split is a rule, not a texture: **if it is a number a player might compare against another number, it is mono.**

Type scale in use: 11 / 12 / 13 / 14 / 16 / 20 / 24 / 26 / 28 / 30 / 44 / 56 / 72 / 88.
Body 16px at line-height 1.6; data rows 1.35; headings line-height 0.92–1.

### Spacing & shape

- Page gutters 40px; section padding 48–72px vertical.
- Card padding 20–28px; rail padding 28px.
- Grid gaps: 24px (cards), 40px (rail ↔ content), 1–2px (hairline-separated cells, using a `lichen` background behind the grid).
- **Border-radius is 0 everywhere.** The only exception is the zone ring, which is a true circle (`border-radius: 50%`).
- Rules: 1px `lichen` for structural borders; 1px `#221D17` for row separators inside content.

## Signature Element: the zone ring

The contracting blue zone is PUBG's most characteristic mechanic and is the one recurring motif in the product. Always `zone`, always meaning "a clock is running on this".

Implementation in the prototype (conic gradient, cheap and exact):

```css
background: conic-gradient(#3E7CA3 var(--pct), rgba(162,149,122,0.2) 0);
border-radius: 50%;
```

- Room cards: 20px ring beside the countdown.
- Room lobby: 220px ring dominating the screen, room code and countdown inside a 186px `ground` disc.
- Deposit confirmation: 120px ring showing confirmation progress.

**When the ring closes past 80%, and only then, it shifts to `flare`** (`#C13B2A`) — the countdown text shifts with it. See `03 Rooms.dc.html`, `renderVals()`: `const color = r.pct > 80 ? FLARE : ZONE`.

Under `prefers-reduced-motion`, the ring must not animate: render a static arc with the numeric countdown beside it.

## Screens / Views

Files are numbered in flow order. Every page except Login carries the same two-row chrome:

**Row 1 — top bar** (64px, `padding: 0 40px`, 1px `lichen` bottom border): wordmark `PUBG WAGER` (12px mono, 2px tracking, `lichen`) on the left; on the right, `AVAILABLE` label + balance (18px mono tabular, `bone`) then the **profile chip** — a 26px `zone` square with initials `YR` in 12px mono `ground`, plus the player name in 13px sans, inside a 1px `lichen` border with `padding: 6px 12px 6px 6px`. The chip links to Profile and is the only entry point to personal data.

**Row 2 — nav tabs** (`padding: 0 40px`, `overflow-x: auto`, 1px `lichen` bottom border): HOME · ROOMS · ROOM LOBBY · MATCH RESULT · PROFILE. Each tab is 12px mono, 1px tracking, `padding: 16px 20px`. Inactive `lichen` with a transparent 2px bottom border; active `bone` with a 2px `zone` bottom border.

---

### 01 Home — `01 Home.dc.html`

**Purpose:** explain the product in one screen and route to Rooms or Login.

- **Hero**, 560px tall, full-bleed map image with a left-to-right scrim `linear-gradient(90deg, rgba(23,19,16,0.95) 0%, rgba(23,19,16,0.7) 50%, rgba(23,19,16,0.2) 100%)`. Content block anchored `left: 40px; bottom: 56px; max-width: 680px`: kicker `SOLANA DEVNET · TEST TOKENS` (13px mono, 2px tracking, `lichen`); headline "Stake on your / own match" at 88px Big Shoulders 900, line-height 0.92, uppercase; paragraph 16px/1.6 max-width 520px; then two buttons, 16px gap — **Browse rooms** (`zone` fill, `ground` text, 14px 600, `padding: 14px 28px`) and **Sign in** (1px `lichen` border, `bone` text).
- **Three ruled rows**, `padding: 64px 40px`. Each row is a 2-column grid `minmax(200px,320px) minmax(0,1fr)` with 40px gap, 32px vertical padding, 1px `#221D17` bottom border. Left: title at 28px Big Shoulders 700 uppercase. Right: 16px/1.6 body, max-width 640px. Titles and copy: *Join a room* / *Play the match* / *Results settle*. **No `01 / 02 / 03` numbering** — nothing here is a sequence.
- **Live now** strip: 8px `flare` square + label, then `repeat(auto-fit, minmax(260px,1fr))` grid of three cards — 150px map image with a bottom scrim, then code (24px Big Shoulders) and meta (13px mono `lichen`).
- **Footer**: 1px `lichen` top border, `DEVNET BUILD · TEST TOKENS HAVE NO MONETARY VALUE` in 12px mono `lichen`.

### 02 Login — `02 Login.dc.html`

**Purpose:** connect a Phantom wallet and link the PUBG in-game name. Both are required before joining a room.

- Two-column split: `grid-template-columns: repeat(auto-fit, minmax(340px,1fr))` — form left, full-height map panel right (1px `lichen` left border, 180° scrim from `rgba(23,19,16,0.35)` to `0.8`). Collapses to stacked at narrow widths.
- Form column `padding: 48px 40px`, content max-width 420px. Heading "Sign in" 56px Big Shoulders 900 uppercase; 16px/1.6 explanatory paragraph.
- **Wallet panel** (1px `lichen`, `panel` fill, 24px padding): label "Wallet" + `Phantom · Solana devnet` in 13px mono `lichen`, with a **Connect** button (`zone` fill, `ground` text) on the right.
- **PUBG name panel**: 15px mono text input on `ground` with a 1px `lichen` border, plus helper "Case sensitive. Match results are read against this name."
- **Continue** button, full width, `zone` fill.
- Compliance line: `18+ ONLY · DEVNET TOKENS HAVE NO MONETARY VALUE` (12px mono `lichen`). Footer line links to Identity Verification.

### 03 Rooms — `03 Rooms.dc.html`

**Purpose:** the primary screen. Find a room that fits skill and budget, understand exactly what is at risk, join in under thirty seconds.

- **Compass strip** below the nav (52px, `padding: 0 40px`): region labels EU / NA / SA / AS / OCE, each in a 24px-padded cell with a 1px `lichen` **left** border acting as a tick mark. Active region is `zone`, others `lichen`. This doubles as the region filter. Filter state should live in the URL.
- **Page head**: "Rooms" 56px Big Shoulders 900 uppercase; sub-line `EU · 12 open · 4 live` 16px `lichen`.
- **Body**: wrapping flex, 40px gap, `padding: 32px 40px 72px`.
  - **Legend rail** — `flex: 0 1 260px`, 1px `lichen` border, `panel` fill, 28px padding. Styled as a map legend: mode checkboxes are 12px squares with 1px `bone` borders (filled with `lichen` when active); "Fee range" is a scale bar (`input[type=range]`, `accent-color: zone`, with 10 / 200 endpoints in 12px mono above it); then "Open only" and "Rooms I joined" keys; then an "EU sector" map thumbnail 150px tall.
  - **Room grid** — `flex: 1 1 520px; min-width: 0`, `grid-template-columns: repeat(auto-fill, minmax(300px,1fr))`, 24px gap.
- **Room card** (`panel` fill, 1px `lichen` border, column flex):
  - 150px map image, bottom scrim `linear-gradient(180deg, rgba(23,19,16,0.05) 40%, rgba(23,19,16,0.9) 100%)`.
  - Status tag top-left on a `ground` plate, `padding: 5px 10px`: 6px status square + 11px mono label. `OPEN` in `lichen`; `JOINED` in `zone`; `LIVE` in `flare`.
  - Overlaid bottom-left: room code 30px Big Shoulders 700 + `MODE · MAP` in 12px mono.
  - Body `padding: 20px 24px 24px`, 12px gap: three label/value rows in 14px mono — Entry fee, Seats (`11/16`), Locks in (20px zone ring + countdown).
  - CTA, flush-left label, `padding: 12px 18px`: **Join room** (`zone` fill, `ground` text) or, for a joined room, **Open lobby** (transparent, 1px `lichen`, `bone` text).
  - Scrims and overlay text are `pointer-events: none` so the underlying image stays interactive.

### 04 Room Lobby — `04 Room Lobby.dc.html`

**Purpose:** confirm what you joined, who else is in, and what the pool pays.

- Two columns: `1fr` map/ring stage (min-height 520px, 1px `lichen` right border) and a 380px detail rail.
- **Stage**: map image at 0.6 opacity with a radial scrim `radial-gradient(circle at 50% 45%, rgba(23,19,16,0.2) 0%, rgba(23,19,16,0.85) 70%)`. Centred: 220px `zone` ring (conic gradient at 62%) containing a 186px `ground` disc with the room code at 40px Big Shoulders 900 and the countdown at 16px mono `zone`. Below: `SQUAD · ERANGEL · LOCKS IN 04:12` in 13px mono `lichen`.
- **Rail** (24–32px padding): "Participants — 11/16" section label; each participant row is name (linked to their PUBG profile) + status in 13px mono `lichen`, separated by 1px `#221D17` rules.
- **Prize pool** breakdown in mono, rake shown explicitly: `Entries (11 × 50)  550`, `Rake (8%)  −44`, then a 1px `lichen` top rule and `Distributed  506` at 20px.
- **Leave room** button, full width, transparent with 1px `flare` border and `flare` label — destructive, so `flare`.

### 05 Profile — `05 Profile.dc.html`

**Purpose:** everything personal in one place — balances, joined rooms, activity, limits. Replaces separate Wallet and Account Limits screens. Reached from the profile chip top right.

- **Identity header** (`padding: 48px 40px 32px`, 1px `lichen` bottom border): 72px `zone` square with 32px Big Shoulders initials; name at 44px Big Shoulders 900 uppercase; meta line `EU · PUBG NAME LINKED · 7xKp…9mQ2` in 13px mono `lichen`. Right side: **Deposit / withdraw** (`zone` fill) and **Verify identity** (1px `lichen`).
- **Three balances** — `repeat(auto-fit, minmax(260px,1fr))` with a 1px gap over a `lichen` background, so the cells are separated by hairlines. This screen's one hard problem is that players confuse these three, so they must read as three visually distinct things:
  - `ON-CHAIN WALLET` 1,860 — "Everything held by your connected Phantom wallet on Solana devnet."
  - `AVAILABLE` 1,240 — "Free to enter a room or withdraw."
  - `LOCKED IN ROOMS` 620 — label, figure **and** a 2px top border all in `zone`, with "Held as entry fees in two open rooms. Returns to available when each room settles."
  - Figures are 44px mono tabular; captions 13px `lichen`.
- **Your rooms** — `repeat(auto-fill, minmax(300px,1fr))` grid of cards (130px map image, status tag, code + `MODE · MAP`, `Staked`, and either `Locks in` with a `zone` countdown or `Alive` with a `flare` figure). Whole card links to the lobby.
- **Recent activity** — `flex: 1 1 420px` column of rows on `panel`, 2px apart, grid `minmax(90px,120px) minmax(0,1fr) 90px 100px`: time (mono `lichen`), description (14px sans), amount (mono; `zone` when escrowed, `bone` otherwise), status (12px mono `lichen`).
- **Limits** — `flex: 0 1 340px`: deposit limit per day (500), session reminder toggle (a 40×22px `zone` block with a 16px `ground` knob — square, no radius), and a self-exclusion panel bordered in `flare` with the copy "Blocks deposits and room entry for a period you choose. Cannot be reversed early once started." These are a licensing requirement; do not bury them.

### 06 Deposit / Withdraw — `06 Deposit Withdraw.dc.html`

**Purpose:** move tokens in and out, and show confirmation progress honestly.

- Two panels, 24px gap, max-width 820px.
- **Left**: connection state — 8px `zone` square + "Phantom connected" + truncated address in 13px mono; then "Amount" with a 24px mono tabular input on `ground`; helper `Available: 1,240 · On-chain: 1,860`; then **Deposit tokens** (`zone` fill) and **Withdraw tokens** (1px `lichen`), equal width.
- **Right**: confirmation state — 120px `zone` ring at 45% with the percentage inside a 100px `ground` disc, "Confirming deposit", and "Waiting on Solana devnet confirmation. This usually takes under a minute."

### 07 Match Result — `07 Match Result.dc.html`

**Purpose:** show placement, per-player kills and payout, and prove the arithmetic.

- Heading "Match result — KX-4471" 44px Big Shoulders 900 uppercase; sub-line `SQUAD · ERANGEL · Settled 08:47`.
- Table: header row in 12px mono `lichen` over a 1px `lichen` rule, then rows on `panel` 2px apart. Columns `60px 1fr 90px 90px 110px` — RANK (20px Big Shoulders), PLAYER (14px sans), KILLS, POINTS, PAYOUT (mono tabular).
- Settlement line, right-aligned above a 1px `lichen` rule: `Pool 550 − Rake 44 =` in `lichen`, `Distributed 506` in `bone`. Rake is always shown explicitly.

### 08 Identity Verification — `08 Identity Verification.dc.html`

**Purpose:** required once, before the first withdrawal. This screen makes people anxious; the design's job is to reduce that. Calm and factual, no urgency styling.

- Heading 44px; sub-line "Required once, before your first withdrawal. Takes about five minutes."
- **Stepper**, max-width 640px: three steps — DETAILS / DOCUMENT / REVIEW. Each marker is a 28px square: completed = `zone` fill with `ground` numeral; current = transparent with 1px `zone` border and `zone` numeral; upcoming = 1px `lichen` with `lichen` numeral. Labels 12px mono `lichen` below. Steps are joined by a 1px `lichen` line that flexes to fill.
- **Form panel** (1px `lichen`, `panel`, 32px padding): "Step 2 — Government-issued document"; document type `<select>`; document number in mono; the reassurance line "Used only to confirm you're eligible to hold and withdraw tokens under regional rules. Not shared with other players."; then **Back** (1px `lichen`) and **Continue** (`zone` fill), equal width.

## Interactions & Behavior

- **Navigation**: nav tabs and the profile chip are plain links. Room cards and "Your rooms" cards link to the lobby. `Join room` → lobby (in production: escrow the fee, then route). An action keeps its name through the flow — the button that says *Join room* produces a state that says *Joined*.
- **Filters**: mode keys, fee range and the region compass filter the room grid. **Filter state lives in the URL** so a filtered browse is shareable and survives reload.
- **Motion is limited to three things**: the zone ring, row/card hover, and a single page-load reveal of the room grid. Nothing else moves. No parallax, no entrance animations on cards, no gradient movement.
- **Hover**: cards and rows lift by tinting the panel one step (e.g. `#282219`); the border stays. Buttons darken/lighten one step from their base.
- **Focus**: every interactive element needs a visible keyboard focus ring in `zone` — `outline: 2px solid #3E7CA3; outline-offset: 2px`. Never leave the browser default.
- **`prefers-reduced-motion`**: the ring stops animating and renders as a static arc with a numeric countdown beside it; the page-load reveal is dropped.
- **Responsive to 375px**: the room grid is already `auto-fill`; the rail wraps above the grid; the Login split stacks; on the match-result and activity tables the rows collapse to stacked lines with fee and seats kept on one line. This last collapse is **not yet implemented** in the prototypes — the tables currently scroll horizontally inside their own container below ~1030px. Implement the stacked collapse in the real build.
- **Errors** state what happened and what to do, e.g. *Not enough available tokens. You have 40 available; 200 is locked in two open rooms.*
- **Empty states** point somewhere, e.g. *No rooms match these filters. Widen the fee range or clear the region.*

## State Management

- `session`: wallet connection (Phantom), linked PUBG name, verification status.
- `balances`: `onChain`, `available`, `locked` — three separate values; never derive one silently from another in the UI, the whole point of the Profile layout is that they are distinguishable.
- `rooms`: list with `code, mode, map, region, fee, seatsFilled, seatsTotal, locksAt, pct, status ('open'|'joined'|'live')`. `pct` drives the ring; `pct > 80` switches ring and countdown to `flare`.
- `filters`: `region, modes[], feeMin, feeMax, openOnly, joinedOnly` — mirrored to the URL query string.
- `myRooms`: joined and live rooms with the staked amount.
- `activity`: time, description, signed amount, status (`ESCROWED` / `PAID` / `CONFIRMED`).
- `limits`: daily deposit limit, session reminder interval, self-exclusion period and start date.
- Countdowns tick client-side from a server-provided lock timestamp; do not trust local clocks for settlement.

## Copy Voice

Flat, specific, operational. Short declaratives. No hype, no second-person cheerleading, no exclamation marks. Buttons say what happens: **Join room**, not *Let's go*; **Withdraw tokens**, not *Cash out now*. Never imply expected winnings, odds in the player's favour, or that stakes are recoverable.

## Assets

`assets/` contains seven PNGs generated for this design — topographic map tiles (contour lines, road runs, an 8×8 grid and a `zone` circle) in the palette:

- `hero-terrain.png` (1600×560) — Home and Rooms hero
- `lobby-terrain.png` (1200×900) — Room Lobby stage, Login panel
- `legend-terrain.png` (400×280) — legend rail thumbnail
- `map-erangel.png`, `map-miramar.png`, `map-sanhok.png`, `map-vikendi.png` (320×320) — room cards

These are **placeholders standing in for real map imagery**. They are not PUBG assets and carry no game IP. In production, substitute licensed or first-party map art at the same aspect ratios.

Icons: none are used. Where an icon would be expected, the design uses a small solid square (6–12px) in a semantic colour. Keep it that way, or use a minimal stroke set — no emoji as iconography.

Fonts load from Google Fonts: `Big Shoulders Display` 500/700/900, `IBM Plex Sans` 400/500/600, `IBM Plex Mono` 400/500. Self-host in production.

## Do Not

The looks that signal "generated" for this category — avoid all of them:

- Near-black backgrounds with purple-to-cyan or violet-to-magenta gradients
- Glassmorphism, frosted panels, glowing card borders, neon outer shadows
- Solana's own purple-green brand gradient anywhere in the chrome
- Animated gradient blobs or mesh backgrounds
- Bento-box grids of unequal rounded rectangles
- `01 / 02 / 03` numbered section markers
- A hero with one enormous number, a small label and three supporting stats
- Emoji as iconography
- Border-radius above 0 on anything except the zone ring

## Files

| File | Screen |
|---|---|
| `01 Home.dc.html` | Home / hero |
| `02 Login.dc.html` | Login |
| `03 Rooms.dc.html` | Room browser (grid) |
| `04 Room Lobby.dc.html` | Room lobby |
| `05 Profile.dc.html` | Profile: balances, your rooms, activity, limits |
| `06 Deposit Withdraw.dc.html` | Deposit / withdraw |
| `07 Match Result.dc.html` | Match result |
| `08 Identity Verification.dc.html` | Identity verification |
| `image-slot.js` | Design-tool image placeholder component — **do not port**, replace with real `<img>` |
| `support.js` | Design-tool runtime — **do not port** |
| `assets/*.png` | Placeholder map imagery |

To view a prototype, open any `.dc.html` in a browser with the folder served locally (the pages fetch sibling files).
