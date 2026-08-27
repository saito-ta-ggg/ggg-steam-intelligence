import { describe, expect, it } from 'vitest';
import {
  computeActivationUnits,
  computeCalendarMonthMoney,
  computeCalendarMonthRevenueShare,
  computeFineGrainMoney,
  computeMonthlyAdditionalRevenueShare,
  computeMonthlyBasicRevenueShare,
  computeUnitMetrics,
  effectiveDiscountPercent,
  monthKey,
  sumSalesMetrics,
} from '@/domain/metrics';
import { round, truncToCents } from '@/domain/numeric';
import { row } from './factory';

describe('unit metrics', () => {
  const rows = [
    row({ gross_units_sold: 100, gross_units_returned: -4, net_units_sold: 96 }),
    row({ gross_units_sold: 300, gross_units_returned: -6, net_units_sold: 294 }),
  ];

  it('sums gross, signed returned and authoritative net units', () => {
    const metrics = computeUnitMetrics(rows);
    expect(metrics.grossUnits).toBe(400);
    expect(metrics.returnedUnitsSigned).toBe(-10);
    expect(metrics.returnedUnitsDisplay).toBe(10);
    expect(metrics.netUnits).toBe(390);
  });

  it('computes Return Rate as -SUM(returned)/SUM(gross)', () => {
    expect(computeUnitMetrics(rows).returnRate).toBeCloseTo(10 / 400, 12);
  });

  it('uses the authoritative net_units_sold rather than deriving gross + returned', () => {
    // A deliberately inconsistent row proves net is read, not recomputed.
    const metrics = computeUnitMetrics([
      row({ gross_units_sold: 100, gross_units_returned: -4, net_units_sold: 90 }),
    ]);
    expect(metrics.netUnits).toBe(90);
  });

  it('returns null Return Rate when there are no gross units', () => {
    expect(computeUnitMetrics([]).returnRate).toBeNull();
    expect(computeUnitMetrics([row({ gross_units_returned: -2 })]).returnRate).toBeNull();
  });

  it('keeps returns negative — a positive returned figure would flip the sign', () => {
    // Guards against an ABS()-style fix hiding a data problem.
    const metrics = computeUnitMetrics([
      row({ gross_units_sold: 100, gross_units_returned: 5, net_units_sold: 105 }),
    ]);
    expect(metrics.returnedUnitsDisplay).toBe(-5);
    expect(metrics.returnRate).toBe(-0.05);
  });
});

describe('fine-grain money', () => {
  it('sums raw stored values without rounding', () => {
    const money = computeFineGrainMoney([
      row({ gross_sales_usd: 10.005, gross_returns_usd: -1.004, net_tax_usd: 0.903, net_sales_usd: 8.098, revenue_share_usd: 5.669 }),
      row({ gross_sales_usd: 20.004, gross_returns_usd: -2.006, net_tax_usd: 1.8, net_sales_usd: 16.198, revenue_share_usd: 11.339 }),
    ]);
    expect(money.grossSales).toBeCloseTo(30.009, 10);
    expect(money.grossReturns).toBeCloseTo(-3.01, 10);
    expect(money.netTax).toBeCloseTo(2.703, 10);
    expect(money.netSteamSales).toBeCloseTo(24.296, 10);
    expect(money.revenueShare).toBeCloseTo(17.008, 10);
    expect(money.aggregation).toBe('fine-grain');
  });

  it('keeps returns signed negative', () => {
    expect(computeFineGrainMoney([row({ gross_returns_usd: -5.5 })]).grossReturns).toBe(-5.5);
  });
});

describe('calendar-month money', () => {
  /**
   * Two packages, each with cents-level residue. The intermediate grain is
   * calendar month x packageid, so each package total is truncated before summing.
   */
  const monthRows = [
    row({ date: '2025-05-01', packageid: 488238, gross_sales_usd: 100.339, gross_returns_usd: -10.339, net_tax_usd: 5.339, net_sales_usd: 84.661 }),
    row({ date: '2025-05-02', packageid: 488238, gross_sales_usd: 0.005, gross_returns_usd: -0.005, net_tax_usd: 0.005, net_sales_usd: -0.005 }),
    row({ date: '2025-05-03', packageid: 512004, gross_sales_usd: 50.999, gross_returns_usd: -1.999, net_tax_usd: 2.999, net_sales_usd: 46.001 }),
  ];

  it('truncates each package-month component to cents before summing', () => {
    const money = computeCalendarMonthMoney(monthRows);
    // package 488238: gross 100.344 -> 100.34, returns -10.344 -> -10.34, tax 5.344 -> 5.34
    // package 512004: gross  50.999 ->  50.99, returns  -1.999 ->  -1.99, tax 2.999 -> 2.99
    expect(money.grossSales).toBeCloseTo(100.34 + 50.99, 10);
    expect(money.grossReturns).toBeCloseTo(-10.34 + -1.99, 10);
    expect(money.netTax).toBeCloseTo(5.34 + 2.99, 10);
    expect(money.aggregation).toBe('calendar-month');
  });

  it('derives monthly_net from the truncated components, not from a raw net sum', () => {
    const money = computeCalendarMonthMoney(monthRows);
    const expected = 100.34 + -10.34 - 5.34 + (50.99 + -1.99 - 2.99);
    expect(money.netSteamSales).toBeCloseTo(expected, 10);
    // The raw sum of net_sales_usd differs, which is exactly why the rule exists.
    expect(money.netSteamSales).not.toBeCloseTo(84.661 - 0.005 + 46.001, 10);
  });

  it('differs from truncating the whole-month total in one step', () => {
    const perPackage = computeCalendarMonthMoney(monthRows).grossSales;
    const naive = truncToCents(100.339 + 0.005 + 50.999);
    expect(perPackage).not.toBeCloseTo(naive, 10);
  });

  it('truncates negative package-month returns toward zero', () => {
    const money = computeCalendarMonthMoney([
      row({ packageid: 1, gross_returns_usd: -3.456 }),
    ]);
    expect(money.grossReturns).toBe(-3.45);
  });
});

describe('calendar-month Revenue Share', () => {
  it('applies the basic 70% component per package-month with TRUNC(ROUND(net,3)*0.70, 2)', () => {
    const rows = [
      row({ packageid: 488238, net_sales_usd: 33.3339 }),
      row({ packageid: 512004, net_sales_usd: 10.1119 }),
    ];
    const expected = truncToCents(round(33.3339, 3) * 0.7) + truncToCents(round(10.1119, 3) * 0.7);
    expect(computeMonthlyBasicRevenueShare(rows)).toBeCloseTo(expected, 10);
  });

  it('does not simply sum row-level revenue_share_usd', () => {
    const rows = [row({ packageid: 488238, net_sales_usd: 100, revenue_share_usd: 999 })];
    expect(computeMonthlyBasicRevenueShare(rows)).toBe(70);
    expect(computeCalendarMonthRevenueShare(rows)).toBe(70);
  });

  it('adds 5% for tier 1 and 10% for tier 2, aggregated by month x appid x tier', () => {
    const rows = [
      row({ packageid: 488238, primary_appid: 1096900, additional_revenue_share_tier: 1, net_sales_usd: 100.004 }),
      row({ packageid: 481511, primary_appid: 1096900, additional_revenue_share_tier: 1, net_sales_usd: 200.006 }),
      row({ packageid: 523771, primary_appid: 1096900, additional_revenue_share_tier: 2, net_sales_usd: 50.009 }),
    ];
    // Package-level Net truncated to cents, then aggregated by appid x tier.
    const tier1 = truncToCents(100.004) + truncToCents(200.006);
    const tier2 = truncToCents(50.009);
    const expected = round(tier1 * 0.05, 2) + round(tier2 * 0.1, 2);
    expect(computeMonthlyAdditionalRevenueShare(rows)).toBeCloseTo(expected, 10);
  });

  it('ignores rows without an additional tier', () => {
    expect(
      computeMonthlyAdditionalRevenueShare([row({ additional_revenue_share_tier: null, net_sales_usd: 1000 })]),
    ).toBe(0);
  });

  it('is basic + additional, i.e. never a blanket Net * 70%', () => {
    const rows = [
      row({ packageid: 488238, additional_revenue_share_tier: 1, net_sales_usd: 1000 }),
    ];
    expect(computeCalendarMonthRevenueShare(rows)).toBeCloseTo(700 + 50, 10);
    expect(computeCalendarMonthRevenueShare(rows)).not.toBeCloseTo(700, 10);
  });

  it('keeps separate primary_appids in separate additional-share buckets', () => {
    const rows = [
      row({ primary_appid: 1096900, packageid: 488238, additional_revenue_share_tier: 1, net_sales_usd: 10.004 }),
      row({ primary_appid: 363890, packageid: 80322, additional_revenue_share_tier: 1, net_sales_usd: 10.004 }),
    ];
    expect(computeMonthlyAdditionalRevenueShare(rows)).toBeCloseTo(round(10 * 0.05, 2) * 2, 10);
  });
});

describe('sumSalesMetrics', () => {
  it('adds already-computed monthly results and recomputes the rate from units', () => {
    const parts = [
      { ...computeUnitMetrics([row({ gross_units_sold: 100, gross_units_returned: -10, net_units_sold: 90 })]), ...computeCalendarMonthMoney([row({ packageid: 1, gross_sales_usd: 10 })]) },
      { ...computeUnitMetrics([row({ gross_units_sold: 300, gross_units_returned: -6, net_units_sold: 294 })]), ...computeCalendarMonthMoney([row({ packageid: 1, gross_sales_usd: 20 })]) },
    ];
    const total = sumSalesMetrics(parts, 'calendar-month');
    expect(total.grossUnits).toBe(400);
    expect(total.grossSales).toBe(30);
    // Not the average of the two rates.
    expect(total.returnRate).toBeCloseTo(16 / 400, 12);
  });
});

describe('effective discount', () => {
  it('is 100*(base-sale)/base when base_price > 0', () => {
    expect(effectiveDiscountPercent(7999, 2399)).toBeCloseTo((100 * (7999 - 2399)) / 7999, 10);
  });

  it('is null when base_price is zero, negative or missing', () => {
    expect(effectiveDiscountPercent(0, 0)).toBeNull();
    expect(effectiveDiscountPercent(-100, 50)).toBeNull();
    expect(effectiveDiscountPercent(null, 50)).toBeNull();
    expect(effectiveDiscountPercent(7999, null)).toBeNull();
  });
});

describe('retail activations', () => {
  it('counts activation units and never touches monetary fields', () => {
    const rows = [
      row({ package_sale_type: 'Retail', gross_units_activated: 30 }),
      row({ package_sale_type: 'Retail', gross_units_activated: 12 }),
    ];
    expect(computeActivationUnits(rows)).toBe(42);
    expect(computeFineGrainMoney(rows).grossSales).toBe(0);
  });
});

describe('monthKey', () => {
  it('extracts YYYY-MM', () => {
    expect(monthKey('2025-05-10')).toBe('2025-05');
  });
});
