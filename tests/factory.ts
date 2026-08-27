import type { DetailedSalesRow } from '@/domain/types';

/** Minimal row builder for metric tests. Only the fields under test are overridden. */
export function row(overrides: Partial<DetailedSalesRow> = {}): DetailedSalesRow {
  return {
    date: '2025-05-10',
    primary_appid: 1096900,
    app_name: 'RPG Maker MZ',
    packageid: 488238,
    package_name: 'RPG Maker MZ',
    bundleid: null,
    bundle_name: null,
    line_item_type: 'Package',
    package_sale_type: 'Steam',
    country_code: 'US',
    country_name: 'United States',
    region: 'North America',
    platform: 'Windows',
    gross_units_sold: 0,
    gross_units_returned: 0,
    net_units_sold: 0,
    gross_sales_usd: 0,
    gross_returns_usd: 0,
    net_tax_usd: 0,
    net_sales_usd: 0,
    revenue_share_usd: 0,
    additional_revenue_share_tier: null,
    base_price: null,
    sale_price: null,
    // The default row is a US row, so its currency is the reference currency.
    // Leaving this null made the defaults internally inconsistent and hid the
    // fact that price observations are market-pinned.
    currency: 'USD',
    total_discount_percentage: null,
    combined_discount_id: null,
    gross_units_activated: 0,
    key_request_id: null,
    territory_code_description: null,
    ...overrides,
  };
}
