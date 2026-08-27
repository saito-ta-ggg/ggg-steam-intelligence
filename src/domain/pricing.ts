/**
 * Pricing / discount detection.
 *
 * There is no canonical sale/event dataset yet (docs/OPEN_QUESTIONS.md #4), so
 * discounted stretches are derived from observed prices and labelled
 * `Detected discounted period` per UI_SPEC.md. No event name is ever invented.
 */
import { effectiveDiscountPercent } from './metrics';
import { safeDivide } from './numeric';
import { addDays } from './dates';
import type { DetailedSalesRow, DetectedDiscountPeriod, PricingPoint, PricingTimeline } from './types';

export const DETECTED_DISCOUNT_LABEL = 'Detected discounted period';

/** A discount is only asserted when an observed effective discount exceeds this. */
const DISCOUNT_EPSILON = 0.5;

interface DayPricing {
  basePrice: number | null;
  salePrice: number | null;
  currency: string | null;
  totalDiscountPercentage: number | null;
  bundleParticipation: boolean;
  grossSales: number;
  grossUnits: number;
  returnedUnitsSigned: number;
  /** Units for the price observation that dominates the day. */
  observationWeight: number;
}

/**
 * Build a per-day pricing timeline. When a day carries several price observations
 * (multiple countries/packages), the one backed by the most gross units wins, so a
 * single low-volume market cannot misrepresent the day's price.
 */
export function buildPricingTimeline(rows: readonly DetailedSalesRow[]): PricingTimeline {
  const byDate = new Map<string, DayPricing>();

  for (const row of rows) {
    let day = byDate.get(row.date);
    if (!day) {
      day = {
        basePrice: null,
        salePrice: null,
        currency: null,
        totalDiscountPercentage: null,
        bundleParticipation: false,
        grossSales: 0,
        grossUnits: 0,
        returnedUnitsSigned: 0,
        observationWeight: -1,
      };
      byDate.set(row.date, day);
    }

    day.grossSales += row.gross_sales_usd;
    day.grossUnits += row.gross_units_sold;
    day.returnedUnitsSigned += row.gross_units_returned;
    // bundleid IS NOT NULL alone does not prove a discount, but it is recorded as
    // bundle participation so the UI can show the indicator UI_SPEC.md asks for.
    if (row.bundleid !== null) day.bundleParticipation = true;

    const weight = row.gross_units_sold;
    if (row.base_price !== null && weight > day.observationWeight) {
      day.observationWeight = weight;
      day.basePrice = row.base_price;
      day.salePrice = row.sale_price;
      day.currency = row.currency;
      day.totalDiscountPercentage = row.total_discount_percentage;
    }
  }

  const points: PricingPoint[] = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, day]) => ({
      date,
      basePrice: day.basePrice,
      salePrice: day.salePrice,
      currency: day.currency,
      effectiveDiscountPercent: effectiveDiscountPercent(day.basePrice, day.salePrice),
      totalDiscountPercentage: day.totalDiscountPercentage,
      bundleParticipation: day.bundleParticipation,
    }));

  return { points, periods: detectDiscountPeriods(points, byDate) };
}

function detectDiscountPeriods(
  points: readonly PricingPoint[],
  byDate: Map<string, DayPricing>,
): DetectedDiscountPeriod[] {
  const periods: DetectedDiscountPeriod[] = [];
  let current: {
    start: string;
    end: string;
    maxDiscountPercent: number;
    basePrice: number | null;
    salePrice: number | null;
    currency: string | null;
    bundleParticipation: boolean;
    grossSales: number;
    grossUnits: number;
    returnedUnitsSigned: number;
  } | null = null;

  const flush = () => {
    if (!current) return;
    periods.push({
      start: current.start,
      end: current.end,
      maxDiscountPercent: current.maxDiscountPercent,
      basePrice: current.basePrice,
      salePrice: current.salePrice,
      currency: current.currency,
      bundleParticipation: current.bundleParticipation,
      grossSales: current.grossSales,
      grossUnits: current.grossUnits,
      returnRate: safeDivide(-current.returnedUnitsSigned, current.grossUnits),
    });
    current = null;
  };

  for (const point of points) {
    const discount = point.effectiveDiscountPercent;
    const day = byDate.get(point.date);
    const discounted = discount !== null && discount > DISCOUNT_EPSILON;

    if (!discounted) {
      flush();
      continue;
    }

    // A gap in the data ends the run: contiguity is required to call it one period.
    if (current !== null && addDays(current.end, 1) !== point.date) flush();

    if (current === null) {
      current = {
        start: point.date,
        end: point.date,
        maxDiscountPercent: discount,
        basePrice: point.basePrice,
        salePrice: point.salePrice,
        currency: point.currency,
        bundleParticipation: point.bundleParticipation,
        grossSales: 0,
        grossUnits: 0,
        returnedUnitsSigned: 0,
      };
    } else {
      current.end = point.date;
      if (discount > current.maxDiscountPercent) {
        current.maxDiscountPercent = discount;
        current.salePrice = point.salePrice;
      }
      if (point.bundleParticipation) current.bundleParticipation = true;
    }

    if (day) {
      current.grossSales += day.grossSales;
      current.grossUnits += day.grossUnits;
      current.returnedUnitsSigned += day.returnedUnitsSigned;
    }
  }

  flush();
  return periods;
}
