import { describe, expect, it } from 'vitest';
import {
  NO_DATA,
  formatDateRange,
  formatMinorUnits,
  formatPercentPoints,
  formatRate,
  formatSignedRate,
  formatUnits,
  formatUsd,
  relativeDelta,
} from '@/domain/format';

describe('missing data is never rendered as zero', () => {
  it('renders null and undefined as "No data"', () => {
    expect(formatUsd(null)).toBe(NO_DATA);
    expect(formatUsd(undefined)).toBe(NO_DATA);
    expect(formatUnits(null)).toBe(NO_DATA);
    expect(formatRate(null)).toBe(NO_DATA);
    expect(formatPercentPoints(null)).toBe(NO_DATA);
    expect(formatMinorUnits(null, 'JPY')).toBe(NO_DATA);
  });

  it('renders NaN and Infinity as "No data" rather than a misleading number', () => {
    expect(formatUsd(Number.NaN)).toBe(NO_DATA);
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe(NO_DATA);
    expect(formatRate(Number.NaN)).toBe(NO_DATA);
  });

  it('still renders a genuine zero as zero', () => {
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUnits(0)).toBe('0');
    expect(formatRate(0)).toBe('0.00%');
  });
});

describe('display precision — USD and rates to 2 decimals', () => {
  it('formats USD to exactly two decimals', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50');
    expect(formatUsd(0.005)).toBe('$0.01');
  });

  it('keeps the negative sign on returns rather than hiding it', () => {
    expect(formatUsd(-1234.56)).toBe('-$1,234.56');
  });

  it('formats rates as percentages to two decimals', () => {
    expect(formatRate(0.0154)).toBe('1.54%');
    expect(formatRate(-0.02)).toBe('-2.00%');
    expect(formatPercentPoints(66.6666)).toBe('66.67%');
  });

  it('formats local minor units with the currency code', () => {
    expect(formatMinorUnits(7999, 'USD')).toBe('79.99 USD');
    expect(formatMinorUnits(848000, 'JPY')).toBe('8480.00 JPY');
    expect(formatMinorUnits(7999, null)).toBe('79.99');
  });

  it('formats units without decimals', () => {
    expect(formatUnits(38216)).toBe('38,216');
  });
});

describe('comparable-period delta', () => {
  it('is null when the previous value is zero, so no infinite growth is shown', () => {
    expect(relativeDelta(100, 0)).toBeNull();
    expect(formatSignedRate(relativeDelta(100, 0))).toBe(NO_DATA);
  });

  it('signs the delta explicitly', () => {
    expect(formatSignedRate(relativeDelta(120, 100))).toBe('+20.00%');
    expect(formatSignedRate(relativeDelta(80, 100))).toBe('-20.00%');
  });
});

describe('date range display', () => {
  it('always shows both ends of the range', () => {
    expect(formatDateRange('2025-04-01', '2026-03-31')).toBe('2025-04-01 – 2026-03-31');
  });
});
