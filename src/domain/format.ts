/**
 * Display formatting.
 *
 * METRICS.md: USD and Return Rate display to 2 decimals by default.
 * UI_SPEC.md: missing data renders as `No data`, never as zero.
 */
export const NO_DATA = 'No data';

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** USD to 2 decimals. Negative values keep their sign (returns are signed negative). */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return usdFormatter.format(value);
}

export function formatUnits(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return integerFormatter.format(value);
}

/** Rate expressed as a fraction (0.0312) rendered as a percentage to 2 decimals. */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${(value * 100).toFixed(2)}%`;
}

/** Value already expressed in percentage points (31.2) rendered to 2 decimals. */
export function formatPercentPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${value.toFixed(2)}%`;
}

/** Local-currency minor units to a readable amount, e.g. 7999 JPY -> "79.99 JPY". */
export function formatMinorUnits(value: number | null | undefined, currency: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${(value / 100).toFixed(2)}${currency ? ` ${currency}` : ''}`;
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
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}
