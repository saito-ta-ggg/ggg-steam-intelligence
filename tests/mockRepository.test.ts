import { describe, expect, it } from 'vitest';
import { MockSalesRepository } from '@/data/mock/mockRepository';
import { MOCK_RANGE, mockRows } from '@/data/mock/fixtures';
import { computeCalendarMonthMetrics, computeFineGrainMetrics } from '@/domain/metrics';
import { matchesScope, createScope } from '@/domain/scope';
import { monthBounds } from '@/domain/dates';
import type { DateRange } from '@/domain/types';

const repository = new MockSalesRepository();
const MZ = 1096900;
const RANGE: DateRange = { start: '2025-04-01', end: '2025-06-30' };

describe('mock fixtures', () => {
  it('are deterministic across calls', () => {
    expect(mockRows()).toBe(mockRows());
    expect(mockRows().length).toBeGreaterThan(1000);
  });

  it('stay inside the declared window', () => {
    for (const row of mockRows()) {
      expect(row.date >= MOCK_RANGE.start && row.date <= MOCK_RANGE.end).toBe(true);
    }
  });

  it('store returns as signed negative values', () => {
    for (const row of mockRows()) {
      expect(row.gross_units_returned).toBeLessThanOrEqual(0);
      expect(row.gross_returns_usd).toBeLessThanOrEqual(0);
    }
  });

  it('never attach Store revenue to Retail activation rows', () => {
    const retail = mockRows().filter((row) => row.package_sale_type === 'Retail');
    expect(retail.length).toBeGreaterThan(0);
    for (const row of retail) {
      expect(row.gross_sales_usd).toBe(0);
      expect(row.net_sales_usd).toBe(0);
      expect(row.gross_units_activated).toBeGreaterThan(0);
    }
  });

  it('contain Steam China rows', () => {
    expect(mockRows().some((row) => row.country_code === 'XC')).toBe(true);
  });
});

describe('MockSalesRepository', () => {
  it('reports itself as the mock source', async () => {
    expect(repository.source).toBe('mock');
    expect((await repository.getFreshness()).source).toBe('mock');
  });

  it('scopes range totals to the base Package family', async () => {
    const scope = createScope(MZ, 'base');
    const totals = await repository.getRangeTotals(scope, RANGE);
    const expected = computeFineGrainMetrics(
      mockRows().filter((row) => row.date >= RANGE.start && row.date <= RANGE.end && matchesScope(row, scope)),
    );
    expect(totals.grossSales).toBeCloseTo(expected.grossSales, 8);
    expect(totals.aggregation).toBe('fine-grain');
  });

  it('returns strictly less base revenue than app-wide revenue', async () => {
    const base = await repository.getRangeTotals(createScope(MZ, 'base'), RANGE);
    const app = await repository.getRangeTotals(createScope(MZ, 'app'), RANGE);
    expect(base.grossSales).toBeGreaterThan(0);
    expect(app.grossSales).toBeGreaterThan(base.grossSales);
  });

  it('never mixes Retail activations into Steam Store money', async () => {
    const steam = await repository.getRangeTotals(createScope(MZ, 'base', 'Steam'), RANGE);
    const retail = await repository.getRangeTotals(createScope(MZ, 'base', 'Retail'), RANGE);
    const activations = await repository.getRetailActivations(createScope(MZ, 'base'), RANGE);
    expect(retail.grossSales).toBe(0);
    expect(steam.grossSales).toBeGreaterThan(0);
    expect(activations.reduce((total, r) => total + r.unitsActivated, 0)).toBeGreaterThan(0);
  });

  it('reports retail activations per package and territory, never merged under one label', async () => {
    const rows = await repository.getRetailActivations(createScope(MZ, 'base'), RANGE);
    expect(rows.length).toBeGreaterThan(1);
    // Every row's territory must describe that row's own count.
    const keys = rows.map((row) => `${row.packageId}|${row.territory}`);
    expect(new Set(keys).size).toBe(rows.length);
    expect(rows.every((row) => row.unitsActivated > 0)).toBe(true);

    // The per-territory rows must add up to the raw activation total for the scope.
    const expected = mockRows()
      .filter(
        (row) =>
          row.date >= RANGE.start &&
          row.date <= RANGE.end &&
          matchesScope(row, { appId: MZ, kind: 'base', saleType: 'Retail' }),
      )
      .reduce((total, row) => total + row.gross_units_activated, 0);
    expect(rows.reduce((total, row) => total + row.unitsActivated, 0)).toBe(expected);
  });

  it('sums daily fine-grain money back to the range total', async () => {
    const scope = createScope(MZ, 'base');
    const daily = await repository.getDailySales(scope, RANGE);
    const totals = await repository.getRangeTotals(scope, RANGE);
    const summed = daily.reduce((total, point) => total + point.grossSales, 0);
    expect(summed).toBeCloseTo(totals.grossSales, 6);
    expect(daily.every((point) => point.aggregation === 'fine-grain')).toBe(true);
  });

  it('labels monthly rows as calendar-month and matches the documented rule', async () => {
    const scope = createScope(MZ, 'base');
    const months = await repository.getMonthlySales(scope, RANGE);
    expect(months.map((month) => month.month)).toEqual(['2025-04', '2025-05', '2025-06']);
    expect(months.every((month) => month.aggregation === 'calendar-month')).toBe(true);

    const may = months.find((month) => month.month === '2025-05');
    const bounds = monthBounds('2025-05');
    const expected = computeCalendarMonthMetrics(
      mockRows().filter((row) => row.date >= bounds.start && row.date <= bounds.end && matchesScope(row, scope)),
    );
    expect(may?.grossSales).toBeCloseTo(expected.grossSales, 8);
    expect(may?.revenueShare).toBeCloseTo(expected.revenueShare, 8);
    expect(may?.partial).toBe(false);
  });

  it('flags a month the selected range only partially covers', async () => {
    const months = await repository.getMonthlySales(createScope(MZ, 'base'), {
      start: '2025-05-10',
      end: '2025-05-20',
    });
    expect(months).toHaveLength(1);
    expect(months[0]?.partial).toBe(true);
  });

  it('produces calendar-month Revenue Share that differs from a raw revenue_share_usd sum', async () => {
    const scope = createScope(MZ, 'base');
    const bounds = monthBounds('2025-05');
    const monthly = await repository.getMonthlySales(scope, bounds);
    const fineGrain = await repository.getRangeTotals(scope, bounds);
    expect(monthly[0]?.revenueShare).not.toBeCloseTo(fineGrain.revenueShare, 2);
  });

  it('aggregates fiscal years from April to March', async () => {
    const years = await repository.getFiscalYearSales(createScope(MZ, 'base'), {
      start: '2025-04-01',
      end: '2026-03-31',
    });
    expect(years).toHaveLength(1);
    expect(years[0]?.fiscalYear).toBe('FY2025');
    expect(years[0]?.partial).toBe(false);

    const split = await repository.getFiscalYearSales(createScope(MZ, 'base'), {
      start: '2026-03-01',
      end: '2026-04-30',
    });
    expect(split.map((year) => year.fiscalYear)).toEqual(['FY2025', 'FY2026']);
    expect(split.every((year) => year.partial)).toBe(true);
  });

  it('flags a fiscal year the range does not span in full, even when no earlier data exists', async () => {
    // The fixtures begin 2024-01-01, so FY2023 can only ever hold Jan–Mar 2024.
    // It must still read as partial rather than as a complete fiscal year.
    const years = await repository.getFiscalYearSales(createScope(MZ, 'base'), MOCK_RANGE);
    const fy2023 = years.find((year) => year.fiscalYear === 'FY2023');
    expect(fy2023?.partial).toBe(true);
  });

  it('labels Steam China correctly and computes sales share', async () => {
    const countries = await repository.getCountryPerformance(createScope(MZ, 'base'), RANGE);
    const china = countries.find((country) => country.countryCode === 'XC');
    expect(china?.countryLabel).toBe('Steam China (Country Code: XC)');
    const shareTotal = countries.reduce((total, country) => total + (country.salesShare ?? 0), 0);
    expect(shareTotal).toBeCloseTo(1, 6);
  });

  it('classifies DLC rows and excludes base packages from the DLC list', async () => {
    const rows = await repository.getDlcPerformance(MZ, RANGE);
    expect(rows.some((r) => r.kind === 'base')).toBe(true);
    const dlc = rows.filter((r) => r.kind === 'dlc');
    expect(dlc.length).toBeGreaterThan(0);
    expect(dlc.every((r) => ![481511, 369820, 488238].includes(r.packageId))).toBe(true);
  });

  it('builds an overview with a comparable preceding period', async () => {
    const overview = await repository.getAppOverview(createScope(MZ, 'base'), RANGE);
    expect(overview.appName).toBe('RPG Maker MZ');
    // 91 days of Q2 compare against the 91 days immediately before them.
    expect(overview.comparison?.range).toEqual({ start: '2024-12-31', end: '2025-03-31' });
    expect(overview.daily.length).toBeGreaterThan(80);
    expect(overview.topCountries.length).toBeGreaterThan(0);
    expect(overview.topDlc.every((r) => r.kind === 'dlc')).toBe(true);
  });

  it('detects discounted periods without naming them', async () => {
    const timeline = await repository.getPricingTimeline(createScope(MZ, 'base'), {
      start: '2025-06-01',
      end: '2025-07-31',
    });
    expect(timeline.periods.length).toBeGreaterThan(0);
    expect(timeline.periods[0]?.maxDiscountPercent).toBeGreaterThan(0);
  });
});
