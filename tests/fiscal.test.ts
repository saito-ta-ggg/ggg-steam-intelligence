import { describe, expect, it } from 'vitest';
import { fiscalYearBounds, fiscalYearLabel, fiscalYearMonths, fiscalYearOf } from '@/domain/fiscal';

describe('fiscal year — starts April 1', () => {
  it('places April through December in the same-numbered FY', () => {
    expect(fiscalYearOf('2025-04-01')).toBe(2025);
    expect(fiscalYearOf('2025-12-31')).toBe(2025);
  });

  it('places January through March in the previous FY', () => {
    expect(fiscalYearOf('2026-01-01')).toBe(2025);
    expect(fiscalYearOf('2026-03-31')).toBe(2025);
    expect(fiscalYearOf('2026-04-01')).toBe(2026);
  });

  it('bounds FY2025 as 2025-04-01 .. 2026-03-31, exactly as METRICS.md states', () => {
    expect(fiscalYearBounds(2025)).toEqual({ start: '2025-04-01', end: '2026-03-31' });
  });

  it('labels and enumerates months in fiscal order', () => {
    expect(fiscalYearLabel(2025)).toBe('FY2025');
    const months = fiscalYearMonths(2025);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-04');
    expect(months[8]).toBe('2025-12');
    expect(months[9]).toBe('2026-01');
    expect(months[11]).toBe('2026-03');
  });
});
