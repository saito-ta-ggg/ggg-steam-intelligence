/**
 * Authoritative metric implementations. Every formula here is transcribed from
 * docs/METRICS.md. Do not add a formula that is not written there.
 */
import { round, safeDivide, trunc, truncToCents } from './numeric';
import type {
  AdditionalRevenueShareTier,
  DetailedSalesRow,
  MoneyMetrics,
  SalesMetrics,
  UnitMetrics,
} from './types';

/* ------------------------------------------------------------------ Units */

/**
 * Gross Units          = SUM(gross_units_sold)
 * Returned Units (signed) = SUM(gross_units_returned)          -- negative as stored
 * Returned Units (display) = -SUM(gross_units_returned)
 * Net Units            = SUM(net_units_sold)                   -- authoritative
 * Return Rate          = -SUM(gross_units_returned) / SUM(gross_units_sold)
 *
 * No ABS(). The negation above is the documented sign flip, not an absolute value.
 */
export function computeUnitMetrics(rows: readonly DetailedSalesRow[]): UnitMetrics {
  let grossUnits = 0;
  let returnedUnitsSigned = 0;
  let netUnits = 0;

  for (const row of rows) {
    grossUnits += row.gross_units_sold;
    returnedUnitsSigned += row.gross_units_returned;
    netUnits += row.net_units_sold;
  }

  return {
    grossUnits,
    returnedUnitsSigned,
    returnedUnitsDisplay: -returnedUnitsSigned,
    netUnits,
    returnRate: safeDivide(-returnedUnitsSigned, grossUnits),
  };
}

/* --------------------------------------------- Fine-grain / non-monthly money */

/**
 * METRICS.md, "Fine-grain/non-monthly money": for day, country, region, platform,
 * partial month and similar grains, sum the raw values and round only for display.
 */
export function computeFineGrainMoney(rows: readonly DetailedSalesRow[]): MoneyMetrics {
  let grossSales = 0;
  let grossReturns = 0;
  let netTax = 0;
  let netSteamSales = 0;
  let revenueShare = 0;

  for (const row of rows) {
    grossSales += row.gross_sales_usd;
    grossReturns += row.gross_returns_usd;
    netTax += row.net_tax_usd;
    netSteamSales += row.net_sales_usd;
    revenueShare += row.revenue_share_usd;
  }

  return {
    grossSales,
    grossReturns,
    netTax,
    netSteamSales,
    revenueShare,
    aggregation: 'fine-grain',
  };
}

/** Units + fine-grain money, the shape used for every non-calendar-month grain. */
export function computeFineGrainMetrics(rows: readonly DetailedSalesRow[]): SalesMetrics {
  return { ...computeUnitMetrics(rows), ...computeFineGrainMoney(rows) };
}

/* --------------------------------------------------- Calendar-month money */

/** `YYYY-MM-DD` -> `YYYY-MM`. */
export function monthKey(date: string): string {
  return date.slice(0, 7);
}

interface PackageMonthAccumulator {
  gross: number;
  returns: number;
  tax: number;
  net: number;
}

function accumulateByPackage(rows: readonly DetailedSalesRow[]): Map<number, PackageMonthAccumulator> {
  const byPackage = new Map<number, PackageMonthAccumulator>();
  for (const row of rows) {
    let acc = byPackage.get(row.packageid);
    if (!acc) {
      acc = { gross: 0, returns: 0, tax: 0, net: 0 };
      byPackage.set(row.packageid, acc);
    }
    acc.gross += row.gross_sales_usd;
    acc.returns += row.gross_returns_usd;
    acc.tax += row.net_tax_usd;
    acc.net += row.net_sales_usd;
  }
  return byPackage;
}

/**
 * METRICS.md, "Calendar-month Gross/Returns/Tax/Net".
 * Intermediate grain: calendar month x packageid.
 *
 *   package_month_gross   = SUM(gross_sales_usd)
 *   monthly_gross   = SUM(TRUNC(package_month_gross,2))
 *   monthly_returns = SUM(TRUNC(package_month_returns,2))
 *   monthly_tax     = SUM(TRUNC(package_month_tax,2))
 *   monthly_net     = SUM(TRUNC(g,2) + TRUNC(r,2) - TRUNC(t,2))
 *
 * ROUND/FLOOR must not be substituted for TRUNC.
 *
 * `rows` must already be restricted to a single calendar month and a single scope.
 */
export function computeCalendarMonthMoney(rows: readonly DetailedSalesRow[]): MoneyMetrics {
  const byPackage = accumulateByPackage(rows);

  let monthlyGross = 0;
  let monthlyReturns = 0;
  let monthlyTax = 0;
  let monthlyNet = 0;

  for (const acc of byPackage.values()) {
    const g = truncToCents(acc.gross);
    const r = truncToCents(acc.returns);
    const t = truncToCents(acc.tax);
    monthlyGross += g;
    monthlyReturns += r;
    monthlyTax += t;
    monthlyNet += g + r - t;
  }

  return {
    grossSales: monthlyGross,
    grossReturns: monthlyReturns,
    netTax: monthlyTax,
    netSteamSales: monthlyNet,
    revenueShare: computeCalendarMonthRevenueShare(rows),
    aggregation: 'calendar-month',
  };
}

/* ------------------------------------------- Revenue Share — calendar month */

/** Additional Revenue Share rate by tier. Tier 1 => 5%, tier 2 => 10%. */
export function additionalTierRate(tier: AdditionalRevenueShareTier): number {
  if (tier === 1) return 0.05;
  if (tier === 2) return 0.1;
  return 0;
}

/**
 * METRICS.md, "Revenue Share — calendar month", basic component:
 *
 *   package_month_net = SUM(net_sales_usd)                       -- per month x packageid
 *   monthly_basic_70  = SUM(TRUNC(ROUND(package_month_net,3)*0.70, 2))
 *
 * Row-level `revenue_share_usd` must NOT simply be summed for this grain.
 */
export function computeMonthlyBasicRevenueShare(rows: readonly DetailedSalesRow[]): number {
  let total = 0;
  for (const acc of accumulateByPackage(rows).values()) {
    total += truncToCents(round(acc.net, 3) * 0.7);
  }
  return total;
}

/**
 * METRICS.md, "Revenue Share — calendar month", additional component:
 *
 *   1. aggregate month x package x primary_appid x tier
 *   2. truncate Package-level Net to cents
 *   3. aggregate by month x primary_appid x tier
 *   4. apply 5% (tier 1) or 10% (tier 2) and ROUND to cents
 */
export function computeMonthlyAdditionalRevenueShare(rows: readonly DetailedSalesRow[]): number {
  // Step 1: month x package x primary_appid x tier.
  const packageLevel = new Map<string, number>();
  for (const row of rows) {
    const tier = row.additional_revenue_share_tier;
    if (tier !== 1 && tier !== 2) continue;
    const key = `${row.primary_appid}|${row.packageid}|${tier}`;
    packageLevel.set(key, (packageLevel.get(key) ?? 0) + row.net_sales_usd);
  }

  // Steps 2 and 3: truncate Package-level Net to cents, then aggregate by appid x tier.
  const appTierLevel = new Map<string, number>();
  for (const [key, net] of packageLevel) {
    const parts = key.split('|');
    const appTierKey = `${parts[0]}|${parts[2]}`;
    appTierLevel.set(appTierKey, (appTierLevel.get(appTierKey) ?? 0) + truncToCents(net));
  }

  // Step 4: apply the tier rate and ROUND to cents.
  let total = 0;
  for (const [key, net] of appTierLevel) {
    const tier = Number(key.split('|')[1]) as 1 | 2;
    total += round(net * additionalTierRate(tier), 2);
  }
  return total;
}

/** monthly_revenue_share = monthly_basic_70 + monthly_additional. */
export function computeCalendarMonthRevenueShare(rows: readonly DetailedSalesRow[]): number {
  return computeMonthlyBasicRevenueShare(rows) + computeMonthlyAdditionalRevenueShare(rows);
}

/** Units + calendar-month money for a single calendar month. */
export function computeCalendarMonthMetrics(rows: readonly DetailedSalesRow[]): SalesMetrics {
  return { ...computeUnitMetrics(rows), ...computeCalendarMonthMoney(rows) };
}

/**
 * Sum already-computed calendar-month results (used for fiscal-year rows).
 *
 * ASSUMPTION (see docs/OPEN_QUESTIONS.md #11): METRICS.md defines a truncation
 * intermediate grain for the calendar month but not for the fiscal year, so a FY
 * total is presented as the sum of its calendar-month values. The UI labels FY
 * rows with the `calendar-month` aggregation so the method is never implicit.
 */
export function sumSalesMetrics(
  parts: readonly SalesMetrics[],
  aggregation: SalesMetrics['aggregation'],
): SalesMetrics {
  let grossUnits = 0;
  let returnedUnitsSigned = 0;
  let netUnits = 0;
  let grossSales = 0;
  let grossReturns = 0;
  let netTax = 0;
  let netSteamSales = 0;
  let revenueShare = 0;

  for (const part of parts) {
    grossUnits += part.grossUnits;
    returnedUnitsSigned += part.returnedUnitsSigned;
    netUnits += part.netUnits;
    grossSales += part.grossSales;
    grossReturns += part.grossReturns;
    netTax += part.netTax;
    netSteamSales += part.netSteamSales;
    revenueShare += part.revenueShare;
  }

  return {
    grossUnits,
    returnedUnitsSigned,
    returnedUnitsDisplay: -returnedUnitsSigned,
    netUnits,
    returnRate: safeDivide(-returnedUnitsSigned, grossUnits),
    grossSales,
    grossReturns,
    netTax,
    netSteamSales,
    revenueShare,
    aggregation,
  };
}

/* -------------------------------------------------------- Effective discount */

/**
 * METRICS.md, "Effective discount": when base_price > 0,
 *   100 * (base_price - sale_price) / base_price
 * Preferred over `total_discount_percentage` alone because bundle adjustments
 * may otherwise be missed. `bundleid IS NOT NULL` alone does not prove a discount.
 */
export function effectiveDiscountPercent(
  basePrice: number | null,
  salePrice: number | null,
): number | null {
  if (basePrice === null || salePrice === null) return null;
  if (!(basePrice > 0)) return null;
  return (100 * (basePrice - salePrice)) / basePrice;
}

/** Retail/CD-key activation units. Not sales revenue — never added to Store money. */
export function computeActivationUnits(rows: readonly DetailedSalesRow[]): number {
  let total = 0;
  for (const row of rows) total += row.gross_units_activated;
  return total;
}

export const EMPTY_SALES_METRICS: SalesMetrics = {
  grossUnits: 0,
  returnedUnitsSigned: 0,
  returnedUnitsDisplay: 0,
  netUnits: 0,
  returnRate: null,
  grossSales: 0,
  grossReturns: 0,
  netTax: 0,
  netSteamSales: 0,
  revenueShare: 0,
  aggregation: 'fine-grain',
};

export { trunc, truncToCents, round };
