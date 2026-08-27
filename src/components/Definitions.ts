/**
 * Metric definition strings shown in the UI tooltips.
 *
 * UI_SPEC.md requires an explicit definition alongside every KPI. Each string is
 * a transcription of docs/METRICS.md so the formula a user sees is the formula
 * the code runs. Do not paraphrase a rule that is not written there.
 */
export const DEFINITIONS = {
  grossSales: 'Gross Sales = SUM(gross_sales_usd). Steam Store package sales only.',
  grossReturns: 'Gross Returns = SUM(gross_returns_usd). Stored signed negative; never converted to an absolute value.',
  netTax: 'Net Tax = SUM(net_tax_usd).',
  netSteamSales: 'Net Steam Sales = SUM(net_sales_usd), the authoritative stored value.',
  revenueShare:
    'Revenue Share (internal NET). Not a blanket Net x 70%: the basic 70% component is joined by an additional 5% (tier 1) or 10% (tier 2) component. Community Market Game Fee is absent from the warehouse and is not included.',
  grossUnits: 'Gross Units = SUM(gross_units_sold).',
  returnedUnits: 'Returned Units = -SUM(gross_units_returned). Stored signed negative; shown positive here.',
  netUnits: 'Net Units = SUM(net_units_sold), the authoritative stored value.',
  returnRate: 'Return Rate = -SUM(gross_units_returned) / SUM(gross_units_sold).',
  salesShare: "Share of the current scope's Gross Sales in the selected date range.",
  effectiveDiscount:
    'Observed effective discount = 100 x (base_price - sale_price) / base_price when base_price > 0. Preferred over total_discount_percentage alone, which can miss bundle adjustments. Prices are local-currency minor units, so the observation is taken from the US / USD reference market only; mixing markets would compare different currencies.',
  referenceMarket:
    'Phase 1 pricing reference market: US / USD. base_price and sale_price are local-currency minor units, so a day carries a different price in every country. Only the price observation is market-pinned — unit and USD money columns cover the whole selected scope.',
  activations:
    'Retail / CD-key activation units. Activations are not Steam Store revenue and are never added to sales figures.',
  fineGrain:
    'Fine-grain rule: for a day, country, region, platform or partial month, raw stored values are summed and rounded only for display.',
  calendarMonth:
    'Calendar-month rule: the intermediate grain is calendar month x packageid, each component is truncated to cents with TRUNC (never ROUND or FLOOR), then summed.',
  fiscalYear: 'Fiscal year runs 1 April to 31 March. FY2025 = 2025-04-01 .. 2026-03-31.',
  comparison:
    'Comparable period: the range of equal length ending the day before the selected range begins.',
} as const;

export type DefinitionKey = keyof typeof DEFINITIONS;
