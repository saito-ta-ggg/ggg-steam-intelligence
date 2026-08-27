/**
 * Fiscal year handling. METRICS.md: FY starts Apr 1.
 * FY2025 = 2025-04-01 .. 2026-03-31.
 */
import type { DateRange } from './types';

export function fiscalYearOf(date: string): number {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  return month >= 4 ? year : year - 1;
}

export function fiscalYearLabel(fiscalYear: number): string {
  return `FY${fiscalYear}`;
}

export function fiscalYearBounds(fiscalYear: number): DateRange {
  return { start: `${fiscalYear}-04-01`, end: `${fiscalYear + 1}-03-31` };
}

/** `YYYY-MM` month keys belonging to a fiscal year, in chronological order. */
export function fiscalYearMonths(fiscalYear: number): string[] {
  const months: string[] = [];
  for (let index = 0; index < 12; index += 1) {
    const monthNumber = 4 + index;
    const year = monthNumber > 12 ? fiscalYear + 1 : fiscalYear;
    const month = monthNumber > 12 ? monthNumber - 12 : monthNumber;
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}
