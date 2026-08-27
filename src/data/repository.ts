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

  getDlcPerformance(primaryAppId: number, dateRange: DateRange): Promise<DlcPerformanceRow[]>;

  /** Retail/CD-key activations. Activation counts only — never sales revenue. */
  getRetailActivations(scope: Scope, dateRange: DateRange): Promise<RetailActivationRow[]>;

  getPricingTimeline(scope: Scope, dateRange: DateRange): Promise<PricingTimeline>;

  /** Earliest/latest available warehouse date, for freshness display and range defaults. */
  getFreshness(): Promise<DataFreshness>;
}
