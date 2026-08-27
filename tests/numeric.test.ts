import { describe, expect, it } from 'vitest';
import { round, safeDivide, trunc, truncToCents } from '@/domain/numeric';

describe('trunc — BigQuery TRUNC semantics', () => {
  it('truncates positive values toward zero', () => {
    expect(truncToCents(12.349)).toBe(12.34);
    expect(truncToCents(12.341)).toBe(12.34);
  });

  it('truncates negative values toward zero, not toward -Infinity', () => {
    // METRICS.md forbids substituting FLOOR: FLOOR(-12.341, 2) would be -12.35.
    expect(truncToCents(-12.341)).toBe(-12.34);
    expect(truncToCents(-12.349)).toBe(-12.34);
    expect(Math.floor(-12.341 * 100) / 100).toBe(-12.35);
  });

  it('differs from ROUND, which METRICS.md also forbids substituting', () => {
    expect(truncToCents(0.999)).toBe(0.99);
    expect(round(0.999, 2)).toBe(1);
  });

  it('is not defeated by binary floating point representation', () => {
    // 8.28 * 100 is 827.9999999999999 in IEEE-754.
    expect(truncToCents(8.28)).toBe(8.28);
    expect(truncToCents(1.005)).toBe(1);
    expect(trunc(1234.5678, 3)).toBe(1234.567);
  });
});

describe('round — BigQuery ROUND semantics', () => {
  it('rounds halves away from zero, unlike Math.round', () => {
    expect(round(0.5)).toBe(1);
    expect(round(-0.5)).toBe(-1);
    expect(Math.round(-0.5)).toBe(-0);
    expect(round(-2.345, 2)).toBe(-2.35);
    expect(round(2.345, 2)).toBe(2.35);
  });
});

describe('safeDivide', () => {
  it('returns null instead of NaN or Infinity so the UI can render "No data"', () => {
    expect(safeDivide(5, 0)).toBeNull();
    expect(safeDivide(0, 0)).toBeNull();
    expect(safeDivide(1, 4)).toBe(0.25);
  });
});
