# Authoritative Metrics

## Categories
Steam Store sales:
```sql
line_item_type='Package' AND package_sale_type='Steam'
```
Retail/CD-key activation:
```sql
line_item_type='Package' AND package_sale_type='Retail'
```
Retail activation is not Store revenue.

## Units
- Gross Units = `SUM(gross_units_sold)`
- Returned Units, signed = `SUM(gross_units_returned)`
- Returned Units, positive display = `-SUM(gross_units_returned)`
- Net Units = `SUM(net_units_sold)` (authoritative)
- Return Rate = `-SUM(gross_units_returned) / SUM(gross_units_sold)`

## Fine-grain/non-monthly money
For day, country, region, platform, partial month, etc., sum raw values and round only for display:
- Gross Sales = `SUM(gross_sales_usd)`
- Gross Returns = `SUM(gross_returns_usd)` (signed negative)
- Net Tax = `SUM(net_tax_usd)`
- Net Steam Sales = `SUM(net_sales_usd)`
- Revenue Share (internal NET) = `SUM(revenue_share_usd)`

## Calendar-month Gross/Returns/Tax/Net
Intermediate grain: calendar month x `packageid`.
```text
package_month_gross   = SUM(gross_sales_usd)
package_month_returns = SUM(gross_returns_usd)
package_month_tax     = SUM(net_tax_usd)
monthly_gross   = SUM(TRUNC(package_month_gross,2))
monthly_returns = SUM(TRUNC(package_month_returns,2))
monthly_tax     = SUM(TRUNC(package_month_tax,2))
monthly_net     = SUM(TRUNC(package_month_gross,2)+TRUNC(package_month_returns,2)-TRUNC(package_month_tax,2))
```
Do not substitute ROUND/FLOOR.

## Revenue Share — calendar month
Do not simply sum row-level `revenue_share_usd`.
Basic component:
```text
package_month_net = SUM(net_sales_usd)
monthly_basic_70 = SUM(TRUNC(ROUND(package_month_net,3)*0.70,2))
```
Additional component: aggregate month x package x primary_appid x tier; truncate Package-level Net to cents; aggregate by month x primary_appid x tier; apply 5% for tier 1 or 10% for tier 2 and ROUND to cents. `monthly_revenue_share = monthly_basic_70 + monthly_additional`.
Community Market Game Fee is absent and must not be fabricated.

## Effective discount
When `base_price>0`: `100*(base_price-sale_price)/base_price`. Prefer this observed discount over relying only on `total_discount_percentage`; bundle adjustments may otherwise be missed. `bundleid IS NOT NULL` alone does not prove a discount.

## Fiscal year
FY starts Apr 1. Example FY2025 = 2025-04-01 through 2026-03-31.

## Product scope
Bare product title = base product only, DLC excluded.
- RPG Maker MZ: AppID 1096900; base Packages `481511`,`369820`,`488238`; current `488238`.
- RPG Maker MV: AppID 363890; base Packages `65464`,`80322`; `88038` is MV Bundle and excluded.
Do not use `primary_appid` alone for base-product totals.

## Date/display
Warehouse `date` is Steam financial calculation date in Pacific Time; do not silently convert to JST. USD and Return Rate display to 2 decimals by default. Always expose active date range and scope.
