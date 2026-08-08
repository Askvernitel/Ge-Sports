import { describe, expect, it } from 'vitest';
import {
  computeRake,
  decimal128ToMinorUnits,
  minorUnitsToDecimal128,
  minorUnitsToDecimalString,
  parseDecimalStringToMinorUnits,
  splitByWeights,
  splitEvenly,
  sumPayouts,
} from '../src/utils/money.js';

describe('decimal <-> minor unit conversions', () => {
  it('round-trips whole numbers', () => {
    expect(parseDecimalStringToMinorUnits('100')).toBe(100_000_000_000n);
    expect(minorUnitsToDecimalString(100_000_000_000n)).toBe('100');
  });

  it('round-trips fractional values to 9 decimals', () => {
    expect(parseDecimalStringToMinorUnits('0.000000001')).toBe(1n);
    expect(minorUnitsToDecimalString(1n)).toBe('0.000000001');
  });

  it('handles negative values', () => {
    expect(parseDecimalStringToMinorUnits('-5.5')).toBe(-5_500_000_000n);
    expect(minorUnitsToDecimalString(-5_500_000_000n)).toBe('-5.5');
  });

  it('handles zero without a stray minus sign', () => {
    expect(minorUnitsToDecimalString(0n)).toBe('0');
    expect(minorUnitsToDecimalString(-0n)).toBe('0');
  });

  it('round-trips through Decimal128', () => {
    const d = minorUnitsToDecimal128(123_456_789_000n);
    expect(decimal128ToMinorUnits(d)).toBe(123_456_789_000n);
  });
});

describe('computeRake', () => {
  it('computes exact bps rake', () => {
    expect(computeRake(1_000_000_000n, 500)).toBe(50_000_000n); // 5% of 1000
  });

  it('handles 0 bps and 10000 bps edges', () => {
    expect(computeRake(1_000_000_000n, 0)).toBe(0n);
    expect(computeRake(1_000_000_000n, 10000)).toBe(1_000_000_000n);
  });

  it('rejects out-of-range bps', () => {
    expect(() => computeRake(100n, -1)).toThrow();
    expect(() => computeRake(100n, 10001)).toThrow();
  });
});

describe('splitByWeights - exact division', () => {
  it('splits evenly when it divides cleanly', () => {
    const payouts = splitEvenly(900n, ['a', 'b', 'c']);
    expect(payouts).toEqual([
      { key: 'a', amount: 300n },
      { key: 'b', amount: 300n },
      { key: 'c', amount: 300n },
    ]);
    expect(sumPayouts(payouts)).toBe(900n);
  });

  it('distributes remainder deterministically for 550 among 3 equal winners', () => {
    // 550 / 3 = 183.33..., so payouts must sum to exactly 550 with the
    // leftover 1 minor unit going to the first (ranked) entry.
    const payouts = splitEvenly(550n, ['first', 'second', 'third']);
    expect(sumPayouts(payouts)).toBe(550n);
    const byKey = Object.fromEntries(payouts.map((p) => [p.key, p.amount]));
    expect(byKey.first).toBe(184n);
    expect(byKey.second).toBe(183n);
    expect(byKey.third).toBe(183n);
  });

  it('handles weighted (top3-style) splits summing exactly', () => {
    // weights 3:2:1 of 1000 -> 500, 333.33, 166.67
    const payouts = splitByWeights(1000n, [
      { key: 'p1', weight: 3 },
      { key: 'p2', weight: 2 },
      { key: 'p3', weight: 1 },
    ]);
    expect(sumPayouts(payouts)).toBe(1000n);
    const byKey = Object.fromEntries(payouts.map((p) => [p.key, p.amount])) as Record<string, bigint>;
    expect(byKey.p1).toBe(500n);
    expect((byKey.p2 ?? 0n) + (byKey.p3 ?? 0n)).toBe(500n);
  });

  it('returns empty array for zero total with no recipients', () => {
    expect(splitByWeights(0n, [])).toEqual([]);
  });

  it('throws if trying to split a non-zero total with no recipients', () => {
    expect(() => splitByWeights(100n, [])).toThrow();
  });

  it('never produces a negative payout for any weight distribution', () => {
    const payouts = splitByWeights(1n, [
      { key: 'a', weight: 1 },
      { key: 'b', weight: 1 },
      { key: 'c', weight: 1 },
    ]);
    expect(sumPayouts(payouts)).toBe(1n);
    for (const p of payouts) expect(p.amount).toBeGreaterThanOrEqual(0n);
  });
});
