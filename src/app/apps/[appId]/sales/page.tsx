import Link from 'next/link';
import { PageControls } from '@/components/PageControls';
import { RetailActivationsPanel } from '@/components/RetailActivationsPanel';
import { KpiCard } from '@/components/KpiCard';
import { InfoTip } from '@/components/InfoTip';
import { TimeSeriesChart, type SeriesPoint } from '@/components/TimeSeriesChart';
import { formatDateRange, formatRate, formatUnits, formatUsd } from '@/domain/format';
import { fiscalYearBounds } from '@/domain/fiscal';
import { previousRange } from '@/domain/dates';
import { loadPageContext } from '@/lib/pageContext';
import { OVERVIEW_METRICS, buildHref, type Grain, type SearchParams } from '@/lib/params';
import type { MonetaryAggregation, SalesMetrics } from '@/domain/types';

const GRAINS: ReadonlyArray<{ id: Grain; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'monthly', label: 'Calendar month' },
  { id: 'fiscal', label: 'Fiscal year (Apr–Mar)' },
];

interface TableRow extends SalesMetrics {
  readonly key: string;
  readonly date: string;
  readonly partial: boolean;
}

export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'sales');
  const { repository, scope, range, grain } = context;

  const [totals, priorTotals, retailActivations] = await Promise.all([
    repository.getRangeTotals(scope, range),
    repository.getRangeTotals(scope, previousRange(range)),
    repository.getRetailActivations(scope, range),
  ]);

  let rows: TableRow[];
  let aggregation: MonetaryAggregation;

  if (grain === 'daily') {
    const daily = await repository.getDailySales(scope, range);
    rows = daily.map((point) => ({ ...point, key: point.date, date: point.date, partial: false }));
    aggregation = 'fine-grain';
  } else if (grain === 'monthly') {
    const monthly = await repository.getMonthlySales(scope, range);
    rows = monthly.map((point) => ({ ...point, key: point.month, date: `${point.month}-01` }));
    aggregation = 'calendar-month';
  } else {
    const fiscal = await repository.getFiscalYearSales(scope, range);
    rows = fiscal.map((point) => ({
      ...point,
      key: point.fiscalYear,
      date: fiscalYearBounds(Number(point.fiscalYear.slice(2))).start,
    }));
    aggregation = 'calendar-month';
  }

  const metric = OVERVIEW_METRICS.find((item) => item.key === context.metric) ?? OVERVIEW_METRICS[0]!;
  const seriesPoints: SeriesPoint[] = rows.map((row) => ({ key: row.key, date: row.date, value: row[metric.key] }));
  const period = formatDateRange(range.start, range.end);
  const grainLabel = GRAINS.find((item) => item.id === grain)?.label ?? 'Daily';

  const footerTotals = rows.reduce(
    (accumulator, row) => ({
      grossSales: accumulator.grossSales + row.grossSales,
      grossReturns: accumulator.grossReturns + row.grossReturns,
      netTax: accumulator.netTax + row.netTax,
      netSteamSales: accumulator.netSteamSales + row.netSteamSales,
      revenueShare: accumulator.revenueShare + row.revenueShare,
      grossUnits: accumulator.grossUnits + row.grossUnits,
      returnedUnitsSigned: accumulator.returnedUnitsSigned + row.returnedUnitsSigned,
      netUnits: accumulator.netUnits + row.netUnits,
    }),
    { grossSales: 0, grossReturns: 0, netTax: 0, netSteamSales: 0, revenueShare: 0, grossUnits: 0, returnedUnitsSigned: 0, netUnits: 0 },
  );
  const footerReturnRate =
    footerTotals.grossUnits === 0 ? null : -footerTotals.returnedUnitsSigned / footerTotals.grossUnits;

  return (
    <>
      <PageControls context={context} aggregation={aggregation} />

      <section>
        <div className="section-head">
          <h2>Range totals</h2>
          <span className="section-note">
            KPI cards use the fine-grain rule; the table below uses the {grainLabel.toLowerCase()} rule.
          </span>
        </div>
        <div className="kpi-grid">
          <KpiCard label="Gross Sales" definition="grossSales" value={formatUsd(totals.grossSales)} period={period} current={totals.grossSales} previous={priorTotals.grossSales} />
          <KpiCard label="Net Steam Sales" definition="netSteamSales" value={formatUsd(totals.netSteamSales)} period={period} current={totals.netSteamSales} previous={priorTotals.netSteamSales} />
          <KpiCard label="Revenue Share (internal NET)" definition="revenueShare" value={formatUsd(totals.revenueShare)} period={period} current={totals.revenueShare} previous={priorTotals.revenueShare} />
          <KpiCard label="Gross Units" definition="grossUnits" value={formatUnits(totals.grossUnits)} period={period} current={totals.grossUnits} previous={priorTotals.grossUnits} />
          <KpiCard label="Returned Units" definition="returnedUnits" value={formatUnits(totals.returnedUnitsDisplay)} period={period} current={totals.returnedUnitsDisplay} previous={priorTotals.returnedUnitsDisplay} lowerIsBetter />
          <KpiCard label="Net Units" definition="netUnits" value={formatUnits(totals.netUnits)} period={period} current={totals.netUnits} previous={priorTotals.netUnits} />
          <KpiCard label="Return Rate" definition="returnRate" value={formatRate(totals.returnRate)} period={period} current={totals.returnRate} previous={priorTotals.returnRate} lowerIsBetter />
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>
            {grainLabel} trend — {metric.label}{' '}
            <InfoTip definition={aggregation === 'calendar-month' ? 'calendarMonth' : 'fineGrain'} />
          </h2>
          <div className="presets">
            {GRAINS.map((item) => (
              <Link key={item.id} className="preset" aria-current={item.id === grain ? 'page' : undefined} href={buildHref(context.pathname, context.searchParams, { grain: item.id })}>
                {item.label}
              </Link>
            ))}
            {OVERVIEW_METRICS.map((item) => (
              <Link key={item.key} className="preset" aria-current={item.key === metric.key ? 'page' : undefined} href={buildHref(context.pathname, context.searchParams, { metric: item.key })}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="panel panel-pad">
          <TimeSeriesChart points={seriesPoints} label={metric.label} kind={metric.kind} />
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>{grainLabel} detail</h2>
          <span className="section-note">
            {aggregation === 'calendar-month'
              ? 'Monetary columns use the calendar month x packageid intermediate grain with TRUNC to cents.'
              : 'Monetary columns are raw sums of stored values.'}
          </span>
        </div>
        {rows.some((row) => row.partial) ? (
          <div className="notice">
            Rows marked <span className="badge badge-partial">Partial</span> are not fully covered by the selected date
            range, so their monetary totals describe only the days inside the range.
          </div>
        ) : null}
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>{grain === 'daily' ? 'Date' : grain === 'monthly' ? 'Month' : 'Fiscal year'}</th>
                <th className="num">Gross Sales</th>
                <th className="num">Returns</th>
                <th className="num">Tax</th>
                <th className="num">Net Steam Sales</th>
                <th className="num">Revenue Share</th>
                <th className="num">Gross Units</th>
                <th className="num">Returned Units</th>
                <th className="num">Net Units</th>
                <th className="num">Return Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="mono">
                    {row.key} {row.partial ? <span className="badge badge-partial">Partial</span> : null}
                  </td>
                  <td className="num">{formatUsd(row.grossSales)}</td>
                  <td className="num neg">{formatUsd(row.grossReturns)}</td>
                  <td className="num">{formatUsd(row.netTax)}</td>
                  <td className="num">{formatUsd(row.netSteamSales)}</td>
                  <td className="num">{formatUsd(row.revenueShare)}</td>
                  <td className="num">{formatUnits(row.grossUnits)}</td>
                  <td className="num">{formatUnits(row.returnedUnitsDisplay)}</td>
                  <td className="num">{formatUnits(row.netUnits)}</td>
                  <td className="num">{formatRate(row.returnRate)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10}>No data</td>
                </tr>
              ) : null}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td>Total of listed rows</td>
                  <td className="num">{formatUsd(footerTotals.grossSales)}</td>
                  <td className="num neg">{formatUsd(footerTotals.grossReturns)}</td>
                  <td className="num">{formatUsd(footerTotals.netTax)}</td>
                  <td className="num">{formatUsd(footerTotals.netSteamSales)}</td>
                  <td className="num">{formatUsd(footerTotals.revenueShare)}</td>
                  <td className="num">{formatUnits(footerTotals.grossUnits)}</td>
                  <td className="num">{formatUnits(-footerTotals.returnedUnitsSigned)}</td>
                  <td className="num">{formatUnits(footerTotals.netUnits)}</td>
                  <td className="num">{formatRate(footerReturnRate)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <p className="footnote">
          Returns are displayed with their stored negative sign in the Returns column and as a positive count in
          Returned Units, per <code>docs/METRICS.md</code>. Return Rate is recomputed from unit sums, never averaged
          across rows.{' '}
          {aggregation === 'calendar-month'
            ? 'The listed-row total is the sum of the calendar-month values above; it can differ from the fine-grain KPI cards because each package-month is truncated to cents first.'
            : null}
        </p>
      </section>

      <RetailActivationsPanel rows={retailActivations} />
    </>
  );
}
