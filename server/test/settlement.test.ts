import { describe, expect, it } from 'vitest';
import { computePayouts } from '../src/services/settlementService.js';
import { sumPayouts } from '../src/utils/money.js';
import { AppError } from '../src/utils/AppError.js';

describe('computePayouts', () => {
  it('winner_take_all: exact division, single winner gets the whole distributable pool', () => {
    const { rake, distributable, payouts } = computePayouts({
      prizePoolMinor: 1_000_000_000n, // 1.0 token
      rakeBps: 500, // 5%
      payoutStructure: 'winner_take_all',
      entries: [
        { entryId: 'e1', userId: 'u1', placement: 1 },
        { entryId: 'e2', userId: 'u2', placement: 2 },
      ],
    });
    expect(rake).toBe(50_000_000n);
    expect(distributable).toBe(950_000_000n);
    expect(payouts).toEqual([{ key: 'u1', amount: 950_000_000n }]);
    expect(sumPayouts(payouts) + rake).toBe(1_000_000_000n);
  });

  it('top3: remainder handling for a 550 minor-unit pool split 3:2:1 weighted among 3 winners', () => {
    const { rake, distributable, payouts } = computePayouts({
      prizePoolMinor: 550n,
      rakeBps: 0,
      payoutStructure: 'top3',
      entries: [
        { entryId: 'e1', userId: 'u1', placement: 1 },
        { entryId: 'e2', userId: 'u2', placement: 2 },
        { entryId: 'e3', userId: 'u3', placement: 3 },
        { entryId: 'e4', userId: 'u4', placement: 4 },
      ],
    });
    expect(rake).toBe(0n);
    expect(distributable).toBe(550n);
    expect(sumPayouts(payouts)).toBe(550n);
    expect(payouts.find((p) => p.key === 'u4')).toBeUndefined(); // 4th place gets nothing in top3
  });

  it('placement_points: every placed entry gets a nonzero share and the total matches exactly', () => {
    const { payouts, rake } = computePayouts({
      prizePoolMinor: 10_000n,
      rakeBps: 1000, // 10%
      payoutStructure: 'placement_points',
      entries: [
        { entryId: 'e1', userId: 'u1', placement: 1 },
        { entryId: 'e2', userId: 'u2', placement: 2 },
        { entryId: 'e3', userId: 'u3', placement: 3 },
        { entryId: 'e4', userId: 'u4', placement: 4 },
      ],
    });
    expect(sumPayouts(payouts) + rake).toBe(10_000n);
    for (const p of payouts) expect(p.amount).toBeGreaterThan(0n);
    // Better placement should never earn less than a worse placement.
    const byKey = Object.fromEntries(payouts.map((p) => [p.key, p.amount])) as Record<string, bigint>;
    expect(byKey.u1! >= byKey.u2!).toBe(true);
    expect(byKey.u2! >= byKey.u3!).toBe(true);
    expect(byKey.u3! >= byKey.u4!).toBe(true);
  });

  it('asserts sum(payouts) + rake === prizePool exactly across many pool sizes (fuzz)', () => {
    for (let pool = 1; pool < 2000; pool += 37) {
      const { rake, payouts } = computePayouts({
        prizePoolMinor: BigInt(pool),
        rakeBps: 337, // an awkward, non-round rake
        payoutStructure: 'placement_points',
        entries: [
          { entryId: 'e1', userId: 'u1', placement: 1 },
          { entryId: 'e2', userId: 'u2', placement: 2 },
          { entryId: 'e3', userId: 'u3', placement: 3 },
          { entryId: 'e4', userId: 'u4', placement: 4 },
          { entryId: 'e5', userId: 'u5', placement: 5 },
        ],
      });
      expect(sumPayouts(payouts) + rake).toBe(BigInt(pool));
    }
  });

  it('rejects an unknown payout structure loudly rather than guessing', () => {
    expect(() =>
      computePayouts({
        prizePoolMinor: 100n,
        rakeBps: 0,
        // @ts-expect-error intentional invalid structure for the test
        payoutStructure: 'made_up',
        entries: [{ entryId: 'e1', userId: 'u1', placement: 1 }],
      }),
    ).toThrow(AppError);
  });

  it('handles zero placed entries (no verified placements) without violating the invariant when rake is also zero', () => {
    const { payouts, rake } = computePayouts({
      prizePoolMinor: 0n,
      rakeBps: 500,
      payoutStructure: 'winner_take_all',
      entries: [],
    });
    expect(payouts).toEqual([]);
    expect(rake).toBe(0n);
  });
});
