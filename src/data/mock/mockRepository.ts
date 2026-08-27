/**
 * Mock implementation of SalesRepository.
 *
 * Aggregation is delegated entirely to `@/domain/metrics`, so the mock and the
 * BigQuery repository apply the same documented rules and can be reconciled
 * against each other row-for-row.
 */
import { monthBounds, previousRange } from '@/domain/dates';
import { fiscalYearBounds, fiscalYearLabel, fiscalYearOf } from '@/domain/fiscal';
import { countryLabel } from '@/domain/country';
import {
  computeCalendarMonthMetrics,
  computeFineGrainMetrics,
  monthKey,
  sumSalesMetrics,
} from '@/domain/metrics';
import { safeDivide } from '@/domain/numeric';
import { buildPricingTimeline } from '@/domain/pricing';
import { classifyPackage, matchesScope, requireProduct } from '@/domain/scope';
import type {
  AppOverview,
  CountryPerformanceRow,
  DailySalesPoint,
  DataFreshness,
  DateRange,
  DetailedSalesRow,
  DlcPerformanceRow,
  FiscalYearSalesPoint,
  MonthlySalesPoint,
  PricingTimeline,
  RetailActivationRow,
  SalesMetrics,
  Scope,
} from '@/domain/types';
import type { SalesRepository } from '../repository';
import { MOCK_RANGE, mockRows } from './fixtures';

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    const existing = groups.get(groupKey);
    if (existing) existing.push(item);
    else groups.set(groupKey, [item]);
  }
  return groups;
}

export class MockSalesRepository implements SalesRepository {
  readonly source = 'mock' as const;

  private select(scope: Scope, range: DateRange): DetailedSalesRow[] {
    return mockRows().filter(
      (row) => row.date >= range.start && row.date <= range.end && matchesScope(row, scope),
    );
  }

  async getRangeTotals(scope: Scope, dateRange: DateRange): Promise<SalesMetrics> {
    // Fine-grain rule: an arbitrary range is treated as a partial-month grain.
    return computeFineGrainMetrics(this.select(scope, dateRange));
  }

  async getDailySales(scope: Scope, dateRange: DateRange): Promise<DailySalesPoint[]> {
    const byDate = groupBy(this.select(scope, dateRange), (row) => row.date);
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, rows]) => ({ date, ...computeFineGrainMetrics(rows) }));
  }

  async getMonthlySales(scope: Scope, dateRange: DateRange): Promise<MonthlySalesPoint[]> {
    const byMonth = groupBy(this.select(scope, dateRange), (row) => monthKey(row.date));
    return [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, rows]) => {
        const bounds = monthBounds(month);
        const partial = dateRange.start > bounds.start || dateRange.end < bounds.end;
        return { month, partial, ...computeCalendarMonthMetrics(rows) };
      });
  }

  async getFiscalYearSales(scope: Scope, dateRange: DateRange): Promise<FiscalYearSalesPoint[]> {
    const months = await this.getMonthlySales(scope, dateRange);
    const byFiscalYear = groupBy(months, (point) => fiscalYearOf(`${point.month}-01`));

    return [...byFiscalYear.entries()]
      .sort(([a], [b]) => a - b)
      .map(([fiscalYear, points]) => {
        // Partial is a statement about coverage, not about whether data happens to
        // exist: a fiscal year the selected range does not span in full is always
        // flagged, so an FY total is never mistaken for a complete year.
        const bounds = fiscalYearBounds(fiscalYear);
        const partial =
          dateRange.start > bounds.start ||
          dateRange.end < bounds.end ||
          points.some((point) => point.partial);
        return {
          fiscalYear: fiscalYearLabel(fiscalYear),
          partial,
          ...sumSalesMetrics(points, 'calendar-month'),
        };
      });
  }

  async getCountryPerformance(scope: Scope, dateRange: DateRange): Promise<CountryPerformanceRow[]> {
    const rows = this.select(scope, dateRange);
    const totalGross = rows.reduce((total, row) => total + row.gross_sales_usd, 0);
    const byCountry = groupBy(rows, (row) => row.country_code);

    return [...byCountry.entries()]
      .map(([code, countryRows]) => {
        const first = countryRows[0];
        return {
          countryCode: code,
          countryLabel: countryLabel(code, first?.country_name ?? null),
          region: first?.region ?? 'Unknown',
          salesShare: safeDivide(
            countryRows.reduce((total, row) => total + row.gross_sales_usd, 0),
            totalGross,
          ),
          // Country is an explicitly fine-grain grain in METRICS.md.
          ...computeFineGrainMetrics(countryRows),
        };
      })
      .sort((a, b) => b.grossSales - a.grossSales);
  }

  async getPackagePerformance(primaryAppId: number, dateRange: DateRange): Promise<DlcPerformanceRow[]> {
    const product = requireProduct(primaryAppId);
    const rows = mockRows().filter(
      (row) =>
        row.date >= dateRange.start &&
        row.date <= dateRange.end &&
        row.line_item_type === 'Package' &&
        row.package_sale_type === 'Steam' &&
        row.primary_appid === primaryAppId,
    );

    const byPackage = groupBy(rows, (row) => row.packageid);
    return [...byPackage.entries()]
      .map(([packageId, packageRows]) => ({
        packageId,
        packageName: packageRows[0]?.package_name ?? String(packageId),
        kind: classifyPackage(product, packageId),
        ...computeFineGrainMetrics(packageRows),
      }))
      .sort((a, b) => b.grossSales - a.grossSales);
  }

  async getDlcPerformance(primaryAppId: number, dateRange: DateRange): Promise<DlcPerformanceRow[]> {
    // DLC only: base and bundle packages are filtered out here, mirroring the
    // NOT IN UNNEST(@nonDlcPackageIds) predicate in buildDlcPerformanceQuery.
    const all = await this.getPackagePerformance(primaryAppId, dateRange);
    return all.filter((row) => row.kind === 'dlc');
  }

  async getRetailActivations(scope: Scope, dateRange: DateRange): Promise<RetailActivationRow[]> {
    const retailScope: Scope = { ...scope, saleType: 'Retail' };
    // Grouped by package AND territory: collapsing territories into one row while
    // labelling it with an arbitrary one would misattribute the activations.
    const byPackageTerritory = groupBy(
      this.select(retailScope, dateRange),
      (row) => `${row.packageid}\u0000${row.territory_code_description ?? ''}`,
    );

    return [...byPackageTerritory.values()]
      .map((rows) => ({
        packageId: rows[0]?.packageid ?? 0,
        packageName: rows[0]?.package_name ?? '',
        territory: rows[0]?.territory_code_description ?? null,
        unitsActivated: rows.reduce((total, row) => total + row.gross_units_activated, 0),
      }))
      .sort((a, b) => b.unitsActivated - a.unitsActivated);
  }

  async getPricingTimeline(scope: Scope, dateRange: DateRange): Promise<PricingTimeline> {
    return buildPricingTimeline(this.select(scope, dateRange));
  }

  async getAppOverview(scope: Scope, dateRange: DateRange): Promise<AppOverview> {
    const product = requireProduct(scope.appId);
    const [totals, daily, topCountries, dlc, pricing] = await Promise.all([
      this.getRangeTotals(scope, dateRange),
      this.getDailySales(scope, dateRange),
      this.getCountryPerformance(scope, dateRange),
      this.getDlcPerformance(scope.appId, dateRange),
      this.getPricingTimeline(scope, dateRange),
    ]);

    const priorRange = previousRange(dateRange);
    const hasPriorData = priorRange.end >= MOCK_RANGE.start;
    const comparison = hasPriorData
      ? { range: priorRange, totals: await this.getRangeTotals(scope, priorRange) }
      : null;

    return {
      appId: product.appId,
      appName: product.name,
      scope,
      range: dateRange,
      totals,
      comparison,
      daily,
      topCountries: topCountries.slice(0, 8),
      topDlc: dlc.slice(0, 8),
      detectedDiscountPeriods: [...pricing.periods].reverse().slice(0, 8),
    };
  }

  async getFreshness(): Promise<DataFreshness> {
    return { source: 'mock', earliestDate: MOCK_RANGE.start, latestDate: MOCK_RANGE.end };
  }
}
