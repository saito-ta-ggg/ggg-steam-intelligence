/**
 * Domain types mirroring `ggg-dashboard-494707.sales_steam.detailed_sales`
 * (see docs/DATA_MODEL.md, "Phase 1 fields").
 */

/** Steam Store package sale vs. Retail/CD-key activation. Never mixed without a label. */
export type PackageSaleType = 'Steam' | 'Retail';

export type LineItemType = 'Package' | 'Bundle' | 'Other';

/** Additional Revenue Share tier: 1 => 5%, 2 => 10%. Null/0 => no additional component. */
export type AdditionalRevenueShareTier = 1 | 2 | null;

/** One row of detailed_sales. Money is USD; returns/tax fields are signed as stored. */
export interface DetailedSalesRow {
  /** Steam financial calculation date in Pacific Time, ISO `YYYY-MM-DD`. Never silently converted to JST. */
  readonly date: string;
  readonly primary_appid: number;
  readonly app_name: string;
  readonly packageid: number;
  readonly package_name: string;
  readonly bundleid: number | null;
  readonly bundle_name: string | null;
  readonly line_item_type: LineItemType;
  readonly package_sale_type: PackageSaleType;

  readonly country_code: string;
  readonly country_name: string;
  readonly region: string;
  readonly platform: string;

  readonly gross_units_sold: number;
  /** Signed negative. */
  readonly gross_units_returned: number;
  /** Authoritative stored value. */
  readonly net_units_sold: number;
  readonly gross_sales_usd: number;
  /** Signed negative. */
  readonly gross_returns_usd: number;
  readonly net_tax_usd: number;
  /** Authoritative stored value. */
  readonly net_sales_usd: number;
  /** Warehouse-derived. Not summable for calendar-month Revenue Share. */
  readonly revenue_share_usd: number;
  readonly additional_revenue_share_tier: AdditionalRevenueShareTier;

  /** Local-currency minor units. */
  readonly base_price: number | null;
  /** Local-currency minor units. */
  readonly sale_price: number | null;
  readonly currency: string | null;
  readonly total_discount_percentage: number | null;
  readonly combined_discount_id: string | null;

  readonly gross_units_activated: number;
  readonly key_request_id: string | null;
  readonly territory_code_description: string | null;
}

/** Inclusive date range in warehouse (Pacific) calendar dates, ISO `YYYY-MM-DD`. */
export interface DateRange {
  readonly start: string;
  readonly end: string;
}

/**
 * Product scope.
 * - `base`: base product only, DLC excluded. Resolved through the Package family,
 *   never through `primary_appid` alone (METRICS.md, "Product scope").
 * - `app`: everything under the parent AppID, DLC included.
 * - `dlc`: non-base packages under the parent AppID.
 */
export type ScopeKind = 'base' | 'app' | 'dlc';

export interface Scope {
  readonly appId: number;
  readonly kind: ScopeKind;
  /** Steam Store sales and Retail activations are always queried separately. */
  readonly saleType: PackageSaleType;
}

/** Units block. All figures are unit counts, not money. */
export interface UnitMetrics {
  readonly grossUnits: number;
  /** Signed negative, as stored. */
  readonly returnedUnitsSigned: number;
  /** Positive display value = -SUM(gross_units_returned). */
  readonly returnedUnitsDisplay: number;
  /** Authoritative SUM(net_units_sold). */
  readonly netUnits: number;
  /** -SUM(gross_units_returned) / SUM(gross_units_sold). Null when no gross units. */
  readonly returnRate: number | null;
}

/** Monetary block. `aggregation` records which METRICS.md rule produced it. */
export interface MoneyMetrics {
  readonly grossSales: number;
  /** Signed negative. */
  readonly grossReturns: number;
  readonly netTax: number;
  readonly netSteamSales: number;
  readonly revenueShare: number;
  readonly aggregation: MonetaryAggregation;
}

/**
 * - `fine-grain`: raw SUM of stored values (day, country, region, platform, partial month).
 * - `calendar-month`: calendar month x packageid intermediate grain with TRUNC to cents.
 */
export type MonetaryAggregation = 'fine-grain' | 'calendar-month';

export interface SalesMetrics extends UnitMetrics, MoneyMetrics {}

export interface DailySalesPoint extends SalesMetrics {
  readonly date: string;
}

export interface MonthlySalesPoint extends SalesMetrics {
  /** `YYYY-MM`. */
  readonly month: string;
  /** True when the selected date range does not cover every day of the calendar month. */
  readonly partial: boolean;
}

export interface FiscalYearSalesPoint extends SalesMetrics {
  /** FY label, e.g. `FY2025` = 2025-04-01 .. 2026-03-31. */
  readonly fiscalYear: string;
  readonly partial: boolean;
}

export interface CountryPerformanceRow extends SalesMetrics {
  readonly countryCode: string;
  /** Display label; `XC` renders as `Steam China (Country Code: XC)`. */
  readonly countryLabel: string;
  readonly region: string;
  /** Share of the scope's total Gross Sales in the selected range. Null when total is 0. */
  readonly salesShare: number | null;
}

export type PackageKind = 'base' | 'dlc' | 'bundle';

export interface DlcPerformanceRow extends SalesMetrics {
  readonly packageId: number;
  readonly packageName: string;
  readonly kind: PackageKind;
}

export interface RetailActivationRow {
  readonly packageId: number;
  readonly packageName: string;
  readonly territory: string | null;
  /** Activation counts. NOT sales revenue (METRICS.md). */
  readonly unitsActivated: number;
}

export interface AppOverview {
  readonly appId: number;
  readonly appName: string;
  readonly scope: Scope;
  readonly range: DateRange;
  readonly totals: SalesMetrics;
  /** Same metrics over the immediately preceding range of equal length, when data exists. */
  readonly comparison: ComparisonPeriod | null;
  readonly daily: readonly DailySalesPoint[];
  readonly topCountries: readonly CountryPerformanceRow[];
  readonly topDlc: readonly DlcPerformanceRow[];
  readonly detectedDiscountPeriods: readonly DetectedDiscountPeriod[];
}

export interface ComparisonPeriod {
  readonly range: DateRange;
  readonly totals: SalesMetrics;
}

/**
 * A contiguous run of days where an observed effective discount was present.
 * UI_SPEC.md: without a canonical event source these are labelled
 * `Detected discounted period` and never given an invented event name.
 */
export interface DetectedDiscountPeriod {
  readonly start: string;
  readonly end: string;
  /** Highest observed effective discount percentage across the period. */
  readonly maxDiscountPercent: number;
  readonly basePrice: number | null;
  readonly salePrice: number | null;
  readonly currency: string | null;
  readonly bundleParticipation: boolean;
  readonly grossSales: number;
  readonly grossUnits: number;
  readonly returnRate: number | null;
}

export interface PricingPoint {
  readonly date: string;
  readonly basePrice: number | null;
  readonly salePrice: number | null;
  readonly currency: string | null;
  /** 100*(base_price-sale_price)/base_price when base_price > 0, else null. */
  readonly effectiveDiscountPercent: number | null;
  readonly totalDiscountPercentage: number | null;
  readonly bundleParticipation: boolean;
}

export interface PricingTimeline {
  readonly points: readonly PricingPoint[];
  readonly periods: readonly DetectedDiscountPeriod[];
}

/** Freshness metadata surfaced by the UI (UI_SPEC.md "Show freshness when available"). */
export interface DataFreshness {
  readonly source: 'mock' | 'bigquery';
  readonly latestDate: string | null;
  readonly earliestDate: string | null;
}
