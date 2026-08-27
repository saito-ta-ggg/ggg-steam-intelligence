/**
 * Display formatting.
 *
 * UI rule: displayed numeric values are rounded to the nearest whole number.
 * UI_SPEC.md: missing data renders as `No data`, never as zero.
 */
export const NO_DATA = 'No data';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** USD rounded to the nearest whole dollar. Negative values keep their sign. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return usdFormatter.format(value);
}

export function formatUnits(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return integerFormatter.format(value);
}

/** Rate expressed as a fraction (0.0312) rendered as a rounded whole percentage. */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${Math.round(value * 100)}%`;
}

/** Value already expressed in percentage points (31.2) rendered as a rounded whole percentage. */
export function formatPercentPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${Math.round(value)}%`;
}

/** Local-currency minor units rounded to a whole major-currency amount. */
export function formatMinorUnits(value: number | null | undefined, currency: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${Math.round(value / 100)}${currency ? ` ${currency}` : ''}`;
}

export function formatDateRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

/** Signed delta between two comparable-period values, as a fraction. */
export function relativeDelta(current: number, previous: number): number | null {
  if (previous === 0 || !Number.isFinite(previous)) return null;
  return (current - previous) / previous;
}

export function formatSignedRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  const rounded = Math.round(value * 100);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}
