import { Types } from 'mongoose';

/**
 * All money math in this file operates on BigInt "minor units" (the smallest
 * indivisible unit of the platform token, analogous to lamports/cents).
 * Floats are never used for money. Decimal128 is only a storage format at
 * the Mongoose boundary; conversions happen exclusively in these helpers.
 *
 * We fix MINOR_UNIT_DECIMALS = 9 to match the SPL token's on-chain decimals,
 * so a platform balance minor unit equals one lamport-equivalent of the
 * custom mint. Decimal128 values in Mongo are stored as decimal strings with
 * up to 9 fractional digits.
 */
export const MINOR_UNIT_DECIMALS = 9;
const SCALE = 10n ** BigInt(MINOR_UNIT_DECIMALS);

export function decimal128ToMinorUnits(value: Types.Decimal128 | string | number): bigint {
  const str = typeof value === 'object' ? value.toString() : String(value);
  return parseDecimalStringToMinorUnits(str);
}

export function parseDecimalStringToMinorUnits(str: string): bigint {
  const negative = str.trim().startsWith('-');
  const unsigned = negative ? str.trim().slice(1) : str.trim();
  const [wholeRaw = '', fracRaw = ''] = unsigned.split('.');
  const whole = wholeRaw === '' ? '0' : wholeRaw;
  const frac = (fracRaw + '0'.repeat(MINOR_UNIT_DECIMALS)).slice(0, MINOR_UNIT_DECIMALS);
  const minor = BigInt(whole) * SCALE + BigInt(frac === '' ? '0' : frac);
  return negative ? -minor : minor;
}

export function minorUnitsToDecimal128(minor: bigint): Types.Decimal128 {
  return Types.Decimal128.fromString(minorUnitsToDecimalString(minor));
}

export function minorUnitsToDecimalString(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / SCALE;
  const frac = abs % SCALE;
  const fracStr = frac.toString().padStart(MINOR_UNIT_DECIMALS, '0').replace(/0+$/, '');
  const sign = negative && (whole !== 0n || frac !== 0n) ? '-' : '';
  return fracStr.length > 0 ? `${sign}${whole}.${fracStr}` : `${sign}${whole}`;
}

/** Compute rake in minor units given prizePool (minor units) and rakeBps (basis points, 10000 = 100%). */
export function computeRake(prizePoolMinor: bigint, rakeBps: number): bigint {
  if (rakeBps < 0 || rakeBps > 10000) throw new Error('rakeBps out of range');
  return (prizePoolMinor * BigInt(rakeBps)) / 10000n;
}

export interface Payout {
  key: string;
  amount: bigint;
}

/**
 * Split `total` minor units across ranked shares (integers, e.g. weights per
 * winner) with zero float error. Uses the largest-remainder method so the
 * sum of outputs always equals `total` exactly, and remainder units are
 * handed out in ranked order (best placement first) rather than arbitrarily,
 * which keeps payouts deterministic and auditable.
 */
export function splitByWeights(total: bigint, weights: { key: string; weight: number }[]): Payout[] {
  if (weights.length === 0) {
    if (total !== 0n) throw new Error('Cannot split non-zero total with no recipients');
    return [];
  }
  const totalWeight = weights.reduce((s, w) => s + BigInt(w.weight), 0n);
  if (totalWeight <= 0n) throw new Error('Total weight must be positive');

  const base: { key: string; amount: bigint; remainder: bigint }[] = weights.map((w) => {
    const weightBig = BigInt(w.weight);
    const rawNumerator = total * weightBig;
    const amount = rawNumerator / totalWeight;
    const remainder = rawNumerator % totalWeight;
    return { key: w.key, amount, remainder };
  });

  let distributed = base.reduce((s, b) => s + b.amount, 0n);
  let leftover = total - distributed;

  // Distribute leftover minor units (guaranteed < weights.length) to the
  // entries with the largest remainders first, ties broken by original order
  // (i.e. ranked/best-placement order, since callers pass weights in that order).
  const order = base
    .map((b, idx) => ({ idx, remainder: b.remainder }))
    .sort((a, b) => (b.remainder > a.remainder ? 1 : b.remainder < a.remainder ? -1 : a.idx - b.idx));

  for (const { idx } of order) {
    if (leftover <= 0n) break;
    const entry = base[idx];
    if (!entry) continue;
    entry.amount += 1n;
    leftover -= 1n;
  }

  return base.map((b) => ({ key: b.key, amount: b.amount }));
}

/** Split total evenly among `count` equal recipients (e.g. winner-take-all with 1 winner is trivial). */
export function splitEvenly(total: bigint, keys: string[]): Payout[] {
  return splitByWeights(
    total,
    keys.map((key) => ({ key, weight: 1 })),
  );
}

export function sumPayouts(payouts: Payout[]): bigint {
  return payouts.reduce((s, p) => s + p.amount, 0n);
}
