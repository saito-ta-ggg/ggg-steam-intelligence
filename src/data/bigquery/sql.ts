/**
 * Phase 2 SQL fragments — NOT YET CONNECTED.
 *
 * Kept beside the repository so the SQL that will replace the mock aggregation is
 * reviewable against docs/METRICS.md before any credential exists. Nothing here is
 * executed in Phase 1.
 *
 * Non-negotiable rules encoded below (docs/DATA_MODEL.md, docs/CLAUDE.md):
 *   - every detailed_sales query carries a `date` partition filter;
 *   - every filter is a named parameter, never string interpolation;
 *   - Steam Store sales and Retail activations are separate queries;
 *   - TRUNC is never replaced by ROUND or FLOOR;
 *   - ABS() never appears in a financial calculation.
 */

export const TABLE = '`ggg-dashboard-494707.sales_steam.detailed_sales`';

/** Shared predicate. `@packageIds` is omitted for app-wide scope. */
export const SCOPE_PREDICATE = `
  date BETWEEN @startDate AND @endDate
  AND line_item_type = 'Package'
  AND package_sale_type = @packageSaleType
  AND primary_appid = @primaryAppId
`;

export const PACKAGE_FILTER = `AND packageid IN UNNEST(@packageIds)`;

/** Fine-grain daily money: raw SUM, rounded only for display. */
export const DAILY_SALES_SQL = `
SELECT
  date,
  SUM(gross_units_sold)                                        AS gross_units,
  SUM(gross_units_returned)                                    AS returned_units_signed,
  SUM(net_units_sold)                                          AS net_units,
  SAFE_DIVIDE(-SUM(gross_units_returned), SUM(gross_units_sold)) AS return_rate,
  SUM(gross_sales_usd)                                         AS gross_sales,
  SUM(gross_returns_usd)                                       AS gross_returns,
  SUM(net_tax_usd)                                             AS net_tax,
  SUM(net_sales_usd)                                           AS net_steam_sales,
  SUM(revenue_share_usd)                                       AS revenue_share
FROM ${TABLE}
WHERE ${SCOPE_PREDICATE}
GROUP BY date
ORDER BY date
`;

/**
 * Calendar-month money. Intermediate grain is calendar month x packageid and each
 * component is truncated to cents before it is summed (METRICS.md).
 */
export const MONTHLY_SALES_SQL = `
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
  WHERE ${SCOPE_PREDICATE}
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
`;

/**
 * Additional Revenue Share component: month x package x primary_appid x tier,
 * Package-level Net truncated to cents, re-aggregated by month x primary_appid x
 * tier, then 5% (tier 1) / 10% (tier 2) and ROUND to cents.
 *
 * Community Market Game Fee is absent from the warehouse and is never fabricated.
 */
export const MONTHLY_ADDITIONAL_REVENUE_SHARE_SQL = `
WITH package_tier_month AS (
  SELECT
    DATE_TRUNC(date, MONTH)              AS month,
    primary_appid,
    packageid,
    additional_revenue_share_tier        AS tier,
    SUM(net_sales_usd)                   AS package_month_net
  FROM ${TABLE}
  WHERE ${SCOPE_PREDICATE}
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
`;

export const COUNTRY_PERFORMANCE_SQL = `
SELECT
  country_code,
  ANY_VALUE(country_name)    AS country_name,
  ANY_VALUE(region)          AS region,
  SUM(gross_units_sold)      AS gross_units,
  SUM(gross_units_returned)  AS returned_units_signed,
  SUM(net_units_sold)        AS net_units,
  SAFE_DIVIDE(-SUM(gross_units_returned), SUM(gross_units_sold)) AS return_rate,
  SUM(gross_sales_usd)       AS gross_sales,
  SUM(gross_returns_usd)     AS gross_returns,
  SUM(net_tax_usd)           AS net_tax,
  SUM(net_sales_usd)         AS net_steam_sales,
  SUM(revenue_share_usd)     AS revenue_share
FROM ${TABLE}
WHERE ${SCOPE_PREDICATE}
GROUP BY country_code
ORDER BY gross_sales DESC
`;

export const DLC_PERFORMANCE_SQL = `
SELECT
  packageid,
  ANY_VALUE(package_name)    AS package_name,
  SUM(gross_units_sold)      AS gross_units,
  SUM(gross_units_returned)  AS returned_units_signed,
  SUM(net_units_sold)        AS net_units,
  SAFE_DIVIDE(-SUM(gross_units_returned), SUM(gross_units_sold)) AS return_rate,
  SUM(gross_sales_usd)       AS gross_sales,
  SUM(gross_returns_usd)     AS gross_returns,
  SUM(net_tax_usd)           AS net_tax,
  SUM(net_sales_usd)         AS net_steam_sales,
  SUM(revenue_share_usd)     AS revenue_share
FROM ${TABLE}
WHERE date BETWEEN @startDate AND @endDate
  AND line_item_type = 'Package'
  AND package_sale_type = 'Steam'
  AND primary_appid = @primaryAppId
GROUP BY packageid
ORDER BY gross_sales DESC
`;

/** Retail/CD-key activations. Activation counts only — never added to Store money. */
export const RETAIL_ACTIVATIONS_SQL = `
SELECT
  packageid,
  ANY_VALUE(package_name)             AS package_name,
  ANY_VALUE(territory_code_description) AS territory,
  SUM(gross_units_activated)          AS units_activated
FROM ${TABLE}
WHERE date BETWEEN @startDate AND @endDate
  AND line_item_type = 'Package'
  AND package_sale_type = 'Retail'
  AND primary_appid = @primaryAppId
GROUP BY packageid
ORDER BY units_activated DESC
`;

/**
 * Observed effective discount. Preferred over total_discount_percentage alone
 * because bundle adjustments may otherwise be missed; bundleid IS NOT NULL on its
 * own does not prove a discount.
 */
export const PRICING_TIMELINE_SQL = `
SELECT
  date,
  ANY_VALUE(base_price)                 AS base_price,
  ANY_VALUE(sale_price)                 AS sale_price,
  ANY_VALUE(currency)                   AS currency,
  ANY_VALUE(total_discount_percentage)  AS total_discount_percentage,
  LOGICAL_OR(bundleid IS NOT NULL)      AS bundle_participation,
  SUM(gross_sales_usd)                  AS gross_sales,
  SUM(gross_units_sold)                 AS gross_units,
  SUM(gross_units_returned)             AS returned_units_signed,
  SAFE_DIVIDE(100 * (ANY_VALUE(base_price) - ANY_VALUE(sale_price)), NULLIF(ANY_VALUE(base_price), 0)) AS effective_discount_percent
FROM ${TABLE}
WHERE ${SCOPE_PREDICATE}
GROUP BY date
ORDER BY date
`;

export const FRESHNESS_SQL = `
SELECT MIN(date) AS earliest_date, MAX(date) AS latest_date
FROM ${TABLE}
WHERE date BETWEEN @startDate AND @endDate
`;
