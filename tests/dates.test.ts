import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetweenInclusive,
  eachDate,
  monthBounds,
  previousRange,
} from '@/domain/dates';

describe('calendar-date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2025-01-01', -1)).toBe('2024-12-31');
  });

  it('counts inclusive day spans', () => {
    expect(daysBetweenInclusive('2025-05-01', '2025-05-01')).toBe(1);
    expect(daysBetweenInclusive('2025-05-01', '2025-05-31')).toBe(31);
  });

  it('bounds calendar months including leap February', () => {
    expect(monthBounds('2025-02')).toEqual({ start: '2025-02-01', end: '2025-02-28' });
    expect(monthBounds('2024-02')).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(monthBounds('2025-12')).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('produces the immediately preceding range of equal length', () => {
    // 31 days of May compare against the 31 days that end the day before May 1,
    // not against the 30 calendar days of April.
    expect(previousRange({ start: '2025-05-01', end: '2025-05-31' })).toEqual({
      start: '2025-03-31',
      end: '2025-04-30',
    });
    expect(previousRange({ start: '2025-06-01', end: '2025-06-30' })).toEqual({
      start: '2025-05-02',
      end: '2025-05-31',
    });
  });

  it('enumerates a range inclusively', () => {
    expect(eachDate({ start: '2025-05-01', end: '2025-05-04' })).toEqual([
      '2025-05-01',
      '2025-05-02',
      '2025-05-03',
      '2025-05-04',
    ]);
  });

  it('rejects malformed dates rather than coercing them', () => {
    expect(() => addDays('2025-5-1', 1)).toThrow(/ISO calendar date/);
  });
});
