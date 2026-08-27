/**
 * Warehouse calendar-date helpers.
 *
 * METRICS.md: the warehouse `date` is the Steam financial calculation date in
 * Pacific Time. It is treated as an opaque calendar date string throughout the
 * app and is never converted to JST or run through the host timezone.
 */
import type { DateRange } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(value: string): string {
  if (!ISO_DATE.test(value)) {
    throw new Error(`Expected an ISO calendar date (YYYY-MM-DD), received "${value}".`);
  }
  return value;
}

/** Days since epoch for an ISO date, computed in UTC so the host timezone is irrelevant. */
function toDayNumber(date: string): number {
  assertIsoDate(date);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function fromDayNumber(dayNumber: number): string {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days);
}

/** Inclusive day count between two ISO dates. */
export function daysBetweenInclusive(start: string, end: string): number {
  return toDayNumber(end) - toDayNumber(start) + 1;
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isWithinRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function eachDate(range: DateRange): string[] {
  const dates: string[] = [];
  const last = toDayNumber(range.end);
  for (let day = toDayNumber(range.start); day <= last; day += 1) {
    dates.push(fromDayNumber(day));
  }
  return dates;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last calendar date of a `YYYY-MM` month key. */
export function monthBounds(month: string): DateRange {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  const last = daysInMonth(year, monthNumber);
  return {
    start: `${month}-01`,
    end: `${month}-${String(last).padStart(2, '0')}`,
  };
}

/** The immediately preceding range of equal length, used for comparable-period deltas. */
export function previousRange(range: DateRange): DateRange {
  const length = daysBetweenInclusive(range.start, range.end);
  return {
    start: addDays(range.start, -length),
    end: addDays(range.start, -1),
  };
}

export function clampRange(range: DateRange, bounds: DateRange): DateRange {
  return {
    start: range.start < bounds.start ? bounds.start : range.start,
    end: range.end > bounds.end ? bounds.end : range.end,
  };
}

export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}
