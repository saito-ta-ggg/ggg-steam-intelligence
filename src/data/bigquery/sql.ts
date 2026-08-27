/**
 * Phase 2 query builders — NOT YET CONNECTED.
 *
 * Kept beside the repository so the SQL that will replace the mock aggregation is
 * reviewable against docs/METRICS.md before any credential exists. Nothing here is
 * executed in Phase 1.
 *
 * These are functions rather than exported SQL strings on purpose. An earlier
 * revision exported a bare `SCOPE_PREDICATE` string alongside a separate
 * `PACKAGE_FILTER` string that each query had to remember to append — and none of
 * them did, so every base-product query silently aggregated on `primary_appid`
 * alone, which METRICS.md explicitly forbids. Scope is now resolved inside the
 * builder from the product catalogue, so a scoped query cannot be constructed
 * without its package filter.
 *
 * Non-negotiable rules encoded below (docs/DATA_MODEL.md, docs/CLAUDE.md):
 *   - every detailed_sales query carries a `date` partition filter;
 *   - every filter is a named parameter, never string interpolation;
 *   - a base-product scope is restricted to its Package family, never primary_appid alone;
 *   - Steam Store sales and Retail activations are separate queries;
 *   - TRUNC is never replaced by ROUND or FLOOR;
 *   - ABS() never appears in a financial calculation.
 */
import { PRICING_REFERENCE_MARKET } from '@/domain/pricing';
import { requireProduct } from '@/domain/scope';
import type { DateRange, Scope } from '@/domain/types';

export const TABLE = '`ggg-dashboard-494707.sales_steam.detailed_sales`';

/**
 * The pricing reference market is defined once in the domain layer so the mock
 * aggregation and this SQL can never drift apart. See `@/domain/pricing`.
 */
export { PRICING_REFERENCE_MARKET, PRICING_REFERENCE_MARKET_LABEL } from '@/domain/pricing';

export type QueryParamValue = string | number | readonly number[];
export type QueryParams = Readonly<Record<string, QueryParamValue>>;

export interface BuiltQuery {
  readonly sql: string;
  readonly params: QueryParams;
}

/**
 * The date partition filter and the channel/product predicate every scoped query
 * shares. Never exported: callers reach it only through `scopedWhere`, which also
 * applies the package family.
 */
const PARTITION_AND_CHANNEL = `date BETWEEN @startDate AND @endDate
    AND line_item_type = 'Package'
    AND package_sale_type = @packageSaleType
    AND primary_appid = @primaryAppId`;

/**
 * Builds the WHERE clause for a scope, resolving the package family from the same
 * product catalogue the domain layer uses.
 *
 * - `base` is restricted to the documented base Package family. METRICS.md:
 *   "Do not use `primary_appid` alone for base-product totals."
 * - `dlc` excludes the base family and any bundle packages, matching
 *   `classifyPackage` in the domain layer.
 * - `app` is the only kind with no package filter, because it deliberately means
 *   every package under the AppID.
 */
function scopedWhere(scope: Scope, range: DateRange): { clause: string; params: QueryParams } {
  const product = requireProduct(scope.appId);
  const params: Record<string, QueryParamValue> = {
    startDate: range.start,
    endDate: range.end,
    packageSaleType: scope.saleType,
    primaryAppId: scope.appId,
  };

  let clause = PARTITION_AND_CHANNEL;

  switch (scope.kind) {
    case 'base':
      clause += `\n    AND packageid IN UNNEST(@basePackageIds)`;
      params.basePackageIds = product.basePackageIds;
      break;
    case 'dlc':
      clause += `\n    AND packageid NOT IN UNNEST(@nonDlcPackageIds)`;
      params.nonDlcPackageIds = [...product.basePackageIds, ...(product.bundlePackageIds ?? [])];
      break;
    case 'app':
      // Every package under the AppID: primary_appid alone is the intended filter here.
      break;
  }

  return { clause, params };
}

/* ------------------------------------------------------------ scoped queries */

/** Fine-grain daily money: raw SUM, rounded only for display. */
export function buildDailySalesQuery(scope: Scope, range: DateRange): BuiltQuery {
  const { clause, params } = scopedWhere(scope, range);
  return {
    params,
    sql: `
SELECT
  date,
  SUM(gross_units_sold)                                          AS gross_units,
  SUM(gross_units_returned)                                      AS returned_units_signed,
  SUM(net_units_sold)                                            AS net_units,
  SAFE_DIVIDE(-SUM(gross_units_returned), SUM(gross_units_sold)) AS return_rate,
  SUM(gross_sales_usd)                                           AS gross_sales,
  SUM(gross_returns_usd)                                         AS gross_returns,
  SUM(net_tax_usd)                                               AS net_tax,
  SUM(net_sales_usd)                                             AS net_steam_sales,
  SUM(revenue_share_usd)                                         AS revenue_share
FROM ${TABLE}
WHERE ${clause}
GROUP BY date
ORDER BY date
`,
  };
}

/**
 * Calendar-month money. Intermediate grain is calendar month x packageid and each
 * component is truncated to cents before it is summed (METRICS.md).
 */
export function buildMonthlySalesQuery(scope: Scope, range: DateRange): BuiltQuery {
  const { clause, params } = scopedWhere(scope, range);
  return {
    params,
    sql: `
WITH package_month AS (
  SELECT
    DATE_TRUNC(date, MONTH)      AS month,
    packageid,
    SUM(gross_sales_usd)         AS package_month_gross,
    SUM(gross_returns_usd)       AS package_month_returns,
    SUM(net_tax_usd)             AS package_month_tax,
    SUM(net_sales_usd)           AS package_month_net,
    SUM(gross_units_sold)        AS gross_units,
    SUM(gross_units_returned)    AS returned_units_signed,
    SUM(net_units_sold)          AS net_units
  FROM ${TABLE}
  WHERE ${clause}
  GROUP BY month, packageid
)
SELECT
  month,
  SUM(TRUNC(package_month_gross, 2))   AS monthly_gross,
  SUM(TRUNC(package_month_returns, 2)) AS monthly_returns,
  SUM(TRUNC(package_month_tax, 2))     AS monthly_tax,
  SUM(TRUNC(package_month_gross, 2) + TRUNC(package_month_returns, 2) - TRUNC(package_month_tax, 2)) AS monthly_net,
  SUM(TRUNC(ROUND(package_month_net, 3) * 0.70, 2)) AS monthly_basic_70,
  SUM(gross_units)                     AS gross_units,
  SUM(returned_units_signed)           AS returned_units_signed,
  SUM(net_units)                       AS net_units,
  SAFE_DIVIDE(-SUM(returned_units_signed), SUM(gross_units)) AS return_rate
FROM package_month
GROUP BY month
ORDER BY month
`,
  };
}

/**
 * Additional Revenue Share component: month x package x primary_appid x tier,
 * Package-level Net truncated to cents, re-aggregated by month x primary_appid x
 * tier, then 5% (tier 1) / 10% (tier 2) and ROUND to cents.
 *
 * Community Market Game Fee is absent from the warehouse and is never fabricated.
 */
export function buildMonthlyAdditionalRevenueShareQuery(scope: Scope, range: DateRange): BuiltQuery {
  const { clause, params } = scopedWhere(scope, range);
  return {
    params,
    sql: `
WITH package_tier_month AS (
  SELECT
    DATE_TRUNC(date, MONTH)        AS month,
    primary_appid,
    packageid,
    additional_revenue_share_tier  AS tier,
    SUM(net_sales_usd)             AS package_month_net
  FROM ${TABLE}
  WHERE ${clause}
    AND additional_revenue_share_tier IN (1, 2)
  GROUP BY month, primary_appid, packageid, tier
),
app_tier_month AS (
  SELECT
    month,
    primary_appid,
    tier,
    SUM(TRUNC(package_month_net, 2)) AS app_month_net
  FROM package_tier_month
  GROUP BY month, primary_appid, tier
)
SELECT
  month,
  SUM(ROUND(app_month_net * IF(tier = 1, 0.05, 0.10), 2)) AS monthly_additional
FROM app_tier_month
GROUP BY month
ORDER BY month
`,
  };
}

export function buildCountryPerformanceQuery(scope: Scope, range: DateRange): BuiltQuery {
  const { clause, params } = scopedWhere(scope, range);
  return {
    params,
    sql: `
SELECT
  country_code,
  ANY_VALUE(country_name)                                        AS country_name,
  ANY_VALUE(region)                                              AS region,
  SUM(gross_units_sold)                                          AS gross_units,
  SUM(gross_units_returned)                                      AS returned_units_signed,
  SUM(net_units_sold)                                            AS net_units,
  SAFE_DIVIDE(-SUM(gross_units_returned), SUM(gross_units_sold)) AS return_rate,
  SUM(gross_sales_usd)                                           AS gross_sales,
  SUM(gross_returns_usd)                                         AS gross_returns,
  SUM(net_tax_usd)                                               AS net_tax,
  SUM(net_sales_usd)                                             AS net_steam_sales,
  SUM(revenue_share_usd)                                         AS revenue_share
FROM ${TABLE}
WHERE ${clause}
GROUP BY country_code
ORDER BY gross_sales DESC
`,
  };
}

/**
 * Price and discount timeline.
 *
 * The price observation is taken from the Phase 1 reference market only
 * (PRICING_REFERENCE_MARKET), because base_price/sale_price are local-currency
 * minor units and mixing markets in one aggregate compares different currencies.
 * Within that market the observation backed by the most gross units wins, so a
 * negligible seller cannot set the day's price.
 *
 * The unit and money columns deliberately stay across the whole scope: they are
 * USD figures and are correct summed worldwide. Only the price is market-pinned.
 *
 * The effective discount follows METRICS.md: 100*(base-sale)/base when base > 0.
 * It is preferred over total_discount_percentage alone because bundle adjustments
 * may otherwise be missed; bundleid IS NOT NULL on its own does not prove a discount.
 */
export function buildPricingTimelineQuery(scope: Scope, range: DateRange): BuiltQuery {
  const { clause, params } = scopedWhere(scope, range);
  return {
    params: {
      ...params,
      pricingCountryCode: PRICING_REFERENCE_MARKET.countryCode,
      pricingCurrency: PRICING_REFERENCE_MARKET.currency,
    },
    sql: `
WITH daily AS (
  SELECT
    date,
    ARRAY_AGG(
      IF(
        country_code = @pricingCountryCode AND currency = @pricingCurrency,
        STRUCT(
          base_price                 AS base_price,
          sale_price                 AS sale_price,
          currency                   AS currency,
          total_discount_percentage  AS total_discount_percentage
        ),
        NULL
      )
      IGNORE NULLS
      ORDER BY gross_units_sold DESC
      LIMIT 1
    )[SAFE_OFFSET(0)]         AS reference_price,
    LOGICAL_OR(bundleid IS NOT NULL) AS bundle_participation,
    SUM(gross_sales_usd)      AS gross_sales,
    SUM(gross_units_sold)     AS gross_units,
    SUM(gross_units_returned) AS returned_units_signed
  FROM ${TABLE}
  WHERE ${clause}
  GROUP BY date
)
SELECT
  date,
  reference_price.base_price                AS base_price,
  reference_price.sale_price                AS sale_price,
  reference_price.currency                  AS currency,
  reference_price.total_discount_percentage AS total_discount_percentage,
  IF(
    reference_price.base_price > 0,
    100 * (reference_price.base_price - reference_price.sale_price) / reference_price.base_price,
    NULL
  ) AS effective_discount_percent,
  bundle_participation,
  gross_sales,
  gross_units,
  returned_units_signed,
  SAFE_DIVIDE(-returned_units_signed, gross_units) AS return_rate
FROM daily
ORDER BY date
`,
  };
}

/**
 * Every builder that takes a Scope.
 *
 * The architecture test iterates this registry and asserts each entry restricts a
 * base scope to its Package family, and separately asserts that no scoped builder
 * exists outside it — so a new query cannot quietly skip the check.
 */
export const SCOPED_QUERY_BUILDERS = {
  buildDailySalesQuery,
  buildMonthlySalesQuery,
  buildMonthlyAdditionalRevenueShareQuery,
  buildCountryPerformanceQuery,
  buildPricingTimelineQuery,
} as const;

/* ------------------------------------------------------- AppID-level queries */

const PACKAGE_METRIC_COLUMNS = `  ANY_VALUE(package_name)                                        AS package_name,
  SUM(gross_units_sold)                                          AS gross_units,
  SUM(gross_units_returned)                                      AS returned_units_signed,
  SUM(net_units_sold)                                            AS net_units,
  SAFE_DIVIDE(-SUM(gross_units_returned), SUM(gross_units_sold)) AS return_rate,
  SUM(gross_sales_usd)                                           AS gross_sales,
  SUM(gross_returns_usd)                                         AS gross_returns,
  SUM(net_tax_usd)                                               AS net_tax,
  SUM(net_sales_usd)                                             AS net_steam_sales,
  SUM(revenue_share_usd)                                         AS revenue_share`;

/**
 * DLC only. The base Package family and any bundle packages are excluded, so a
 * base product can never appear in a DLC list or be counted as DLC revenue.
 */
export function buildDlcPerformanceQuery(primaryAppId: number, range: DateRange): BuiltQuery {
  const product = requireProduct(primaryAppId);
  return {
    params: {
      startDate: range.start,
      endDate: range.end,
      primaryAppId,
      nonDlcPackageIds: [...product.basePackageIds, ...(product.bundlePackageIds ?? [])],
    },
    sql: `
SELECT
  packageid,
${PACKAGE_METRIC_COLUMNS}
FROM ${TABLE}
WHERE date BETWEEN @startDate AND @endDate
  AND line_item_type = 'Package'
  AND package_sale_type = 'Steam'
  AND primary_appid = @primaryAppId
  AND packageid NOT IN UNNEST(@nonDlcPackageIds)
GROUP BY packageid
ORDER BY gross_sales DESC
`,
  };
}

/**
 * Every package under the AppID, base and bundles included.
 *
 * Named for what it returns rather than "DLC", so a caller cannot mistake the
 * result for a DLC list. Callers are responsible for labelling each row's kind
 * through `classifyPackage`.
 */
export function buildPackagePerformanceQuery(primaryAppId: number, range: DateRange): BuiltQuery {
  return {
    params: { startDate: range.start, endDate: range.end, primaryAppId },
    sql: `
SELECT
  packageid,
${PACKAGE_METRIC_COLUMNS}
FROM ${TABLE}
WHERE date BETWEEN @startDate AND @endDate
  AND line_item_type = 'Package'
  AND package_sale_type = 'Steam'
  AND primary_appid = @primaryAppId
GROUP BY packageid
ORDER BY gross_sales DESC
`,
  };
}

/** Retail/CD-key activations. Activation counts only — never added to Store money. */
export function buildRetailActivationsQuery(primaryAppId: number, range: DateRange): BuiltQuery {
  return {
    params: { startDate: range.start, endDate: range.end, primaryAppId },
    sql: `
SELECT
  packageid,
  ANY_VALUE(package_name)     AS package_name,
  territory_code_description  AS territory,
  SUM(gross_units_activated)  AS units_activated
FROM ${TABLE}
WHERE date BETWEEN @startDate AND @endDate
  AND line_item_type = 'Package'
  AND package_sale_type = 'Retail'
  AND primary_appid = @primaryAppId
GROUP BY packageid, territory_code_description
ORDER BY units_activated DESC
`,
  };
}

export function buildFreshnessQuery(range: DateRange): BuiltQuery {
  return {
    params: { startDate: range.start, endDate: range.end },
    sql: `
SELECT MIN(date) AS earliest_date, MAX(date) AS latest_date
FROM ${TABLE}
WHERE date BETWEEN @startDate AND @endDate
`,
  };
}
