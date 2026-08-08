// Money math / formatting utils.
//
// Rule (mirrors spec section 6, "no floats anywhere in money math"): every
// balance and payout in this app is an integer number of whole test-token
// units. We never do float arithmetic on money values client-side beyond
// simple integer add/subtract for display math (e.g. pool - rake). The real
// settlement math happens server-side in integer minor units; the frontend
// only ever displays server-provided numbers or does integer preview math.

/** Mongoose Decimal128 fields serialize over JSON as `{ $numberDecimal: "123.45" }`. */
export function decimalToNumber(value: { $numberDecimal: string } | string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'object') return Number(value.$numberDecimal);
  return Number(value);
}

/** Format an integer token amount with thousands separators, tabular-nums friendly. */
export function formatTokens(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(amount));
  return sign + abs.toLocaleString('en-US');
}

/** Format a signed ledger amount, e.g. "+31" / "-50". */
export function formatSigned(amount: number): string {
  const rounded = Math.trunc(amount);
  if (rounded === 0) return '0';
  const sign = rounded > 0 ? '+' : '−'; // real minus sign, matches design (−44)
  return `${sign}${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** rake = prizePool * rakeBps / 10000, integer basis points math. */
export function computeRake(prizePool: number, rakeBps: number): number {
  return Math.round((prizePool * rakeBps) / 10000);
}

export function computeDistributable(prizePool: number, rakeBps: number): number {
  return prizePool - computeRake(prizePool, rakeBps);
}

export function rakePercentLabel(rakeBps: number): string {
  return `${(rakeBps / 100).toString().replace(/\.0$/, '')}%`;
}
