/**
 * Repository boundary (docs/DATA_MODEL.md, "Repository boundary").
 *
 * Everything below this interface is server-side only. React components never
 * contain SQL and never talk to BigQuery. The mock implementation and the
 * BigQuery implementation must satisfy exactly this contract.
 */
import type {
  AppOverview,
  CountryPerformanceRow,
  DailySalesPoint,
  DataFreshness,
  DateRange,
  DlcPerformanceRow,
  FiscalYearSalesPoint,
  MonthlySalesPoint,
  PricingTimeline,
  RetailActivationRow,
  SalesMetrics,
  Scope,
} from '@/domain/types';

export interface SalesRepository {
  readonly source: 'mock' | 'bigquery';

  getAppOverview(scope: Scope, dateRange: DateRange): Promise<AppOverview>;

  /** Fine-grain rule: daily money is a raw SUM of stored values. */
  getDailySales(scope: Scope, dateRange: DateRange): Promise<DailySalesPoint[]>;

  /** Calendar-month rule: month x packageid intermediate grain with TRUNC to cents. */
  getMonthlySales(scope: Scope, dateRange: DateRange): Promise<MonthlySalesPoint[]>;

  /** FY = Apr–Mar, composed from calendar-month results. */
  getFiscalYearSales(scope: Scope, dateRange: DateRange): Promise<FiscalYearSalesPoint[]>;

  /** Range totals under the fine-grain rule. */
  getRangeTotals(scope: Scope, dateRange: DateRange): Promise<SalesMetrics>;

  getCountryPerformance(scope: Scope, dateRange: DateRange): Promise<CountryPerformanceRow[]>;

  /**
   * DLC only. The base Package family and any bundle packages are excluded, so a
   * base product can never appear in a DLC list or be counted as DLC revenue.
   */
  getDlcPerformance(primaryAppId: number, dateRange: DateRange): Promise<DlcPerformanceRow[]>;

  /**
   * Every package under the AppID, base and bundles included, each labelled with
   * its kind. Named for what it returns rather than "DLC" so the result cannot be
   * mistaken for a DLC list.
   */
  getPackagePerformance(primaryAppId: number, dateRange: DateRange): Promise<DlcPerformanceRow[]>;

  /** Retail/CD-key activations. Activation counts only — never sales revenue. */
  getRetailActivations(scope: Scope, dateRange: DateRange): Promise<RetailActivationRow[]>;

  getPricingTimeline(scope: Scope, dateRange: DateRange): Promise<PricingTimeline>;

  /** Earliest/latest available warehouse date, for freshness display and range defaults. */
  getFreshness(): Promise<DataFreshness>;
}
