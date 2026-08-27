/**
 * Numeric primitives that mirror BigQuery semantics.
 *
 * METRICS.md is explicit that calendar-month monetary aggregation uses TRUNC and
 * that ROUND/FLOOR must not be substituted. Because returns are signed negative,
 * the distinction matters: FLOOR(-1.234, 2) = -1.24 while TRUNC(-1.234, 2) = -1.23.
 */

/**
 * Guards against binary floating point representation error before an integer
 * operation. e.g. 8.28 * 100 === 827.9999999999999 in IEEE-754, which would make
 * a naive truncation return 8.27 for a value that is exactly 8.28 in the source
 * ledger. Snapping at 1e-9 relative precision is far below cent granularity and
 * far above the representation error of realistic USD amounts.
 */
function snap(scaled: number): number {
  if (!Number.isFinite(scaled)) return scaled;
  const rounded = Math.round(scaled);
  return Math.abs(scaled - rounded) < 1e-9 * Math.max(1, Math.abs(scaled)) ? rounded : scaled;
}

/** BigQuery TRUNC(value, digits): truncate toward zero. Never FLOOR. */
export function trunc(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  const scaled = snap(value * factor);
  return Math.trunc(scaled) / factor;
}

/** BigQuery TRUNC(value, 2) — truncate a monetary value to cents, toward zero. */
export function truncToCents(value: number): number {
  return trunc(value, 2);
}

/**
 * BigQuery ROUND(value, digits): half away from zero.
 * JavaScript's Math.round is half toward +Infinity, which differs for negatives
 * (Math.round(-0.5) === -0, BigQuery ROUND(-0.5) === -1).
 */
export function round(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** digits;
  const scaled = snap(value * factor);
  const magnitude = Math.floor(Math.abs(scaled) + 0.5);
  return (scaled < 0 ? -magnitude : magnitude) / factor;
}

/** Sum helper that keeps `null` semantics out of the metric functions. */
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** Divide guarding against a zero denominator; returns null so callers can render "No data". */
export function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0 || !Number.isFinite(denominator)) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}
