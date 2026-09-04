/**
 * Display formatting.
 *
 * UI rule: sales are rounded to whole dollars; other numeric values display to 1 decimal place.
 * UI_SPEC.md: missing data renders as `No data`, never as zero.
 */
export const NO_DATA = 'No data';

const salesUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const decimalUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const decimalFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Sales USD rounded to the nearest whole dollar. Negative values keep their sign. */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return salesUsdFormatter.format(value);
}

/** Non-sales USD values, such as price, displayed to 1 decimal place. */
export function formatUsdOneDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return decimalUsdFormatter.format(value);
}

export function formatUnits(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return decimalFormatter.format(value);
}

/** Rate expressed as a fraction (0.0312) rendered as a percentage to 1 decimal place. */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${(value * 100).toFixed(1)}%`;
}

/** Value already expressed in percentage points (31.2) rendered to 1 decimal place. */
export function formatPercentPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${value.toFixed(1)}%`;
}

/** Local-currency minor units rendered to 1 decimal place in major-currency units. */
export function formatMinorUnits(value: number | null | undefined, currency: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_DATA;
  return `${(value / 100).toFixed(1)}${currency ? ` ${currency}` : ''}`;
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
  const percentage = value * 100;
  const sign = percentage > 0 ? '+' : '';
  return `${sign}${percentage.toFixed(1)}%`;
}
