# Data Model

## Existing warehouse
`ggg-dashboard-494707.sales_steam.detailed_sales`; location `asia-northeast1`; partition `date` (required filter); upstream Steamworks `IPartnerFinancialsService.GetDetailedSales`.

## Phase 1 fields
Identity: `date, primary_appid, app_name, packageid, package_name, bundleid, bundle_name, line_item_type, package_sale_type`.
Geography/platform: `country_code, country_name, region, platform`.
Sales: `gross_units_sold, gross_units_returned, net_units_sold, gross_sales_usd, gross_returns_usd, net_tax_usd, net_sales_usd, revenue_share_usd, additional_revenue_share_tier`.
Price: `base_price, sale_price, currency, total_discount_percentage, combined_discount_id`.
Retail: `gross_units_activated, key_request_id, territory_code_description`.

## Semantics
Returns are signed negative. `net_units_sold`/`net_sales_usd` are authoritative stored values. `revenue_share_usd` is warehouse-derived. `XC`/`Unknown Country` = Steam China. `base_price`/`sale_price` are local-currency minor units.

## Repository boundary
Suggested server functions:
```ts
getAppOverview(scope,dateRange)
getDailySales(scope,dateRange)
getMonthlySales(scope,dateRange)
getCountryPerformance(scope,dateRange)
getDlcPerformance(primaryAppId,dateRange)
getRetailActivations(scope,dateRange)
getPricingTimeline(scope,dateRange)
```
React components contain no SQL.

## Future tables (provisional names)
- `steam_reviews`: one row per recommendation, preserve API fields where practical.
- `steam_review_daily_snapshot`: AppID x date summary.
- `steam_wishlist_daily`: daily wishlist reporting.
- `steam_store_snapshot`: official/public product/store metadata snapshots.
- `steam_events`: normalized timeline events with `event_id, appid, event_type, start_at, end_at, name, source, metadata_json`.
- `steam_ccu_snapshot` (provisional, Phase 2A): AppID x timestamp concurrent-player snapshot. No source is connected yet; see `docs/OPEN_QUESTIONS.md` #19.

## Performance/security
Parameterize all filters; require date partition filter; cache common server queries; never query full portfolio on each page load; BigQuery read-only/server-side only.
