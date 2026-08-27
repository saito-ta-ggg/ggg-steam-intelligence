import Link from 'next/link';
import { PageControls } from '@/components/PageControls';
import { KpiCard } from '@/components/KpiCard';
import { InfoTip } from '@/components/InfoTip';
import { TimeSeriesChart, type SeriesPoint } from '@/components/TimeSeriesChart';
import {
  formatDateRange,
  formatPercentPoints,
  formatRate,
  formatUnits,
  formatUsd,
} from '@/domain/format';
import { loadPageContext } from '@/lib/pageContext';
import { OVERVIEW_METRICS, buildHref, type SearchParams } from '@/lib/params';
import { DETECTED_DISCOUNT_LABEL, PRICING_REFERENCE_MARKET_LABEL } from '@/domain/pricing';

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'overview');
  const overview = await context.repository.getAppOverview(context.scope, context.range);
  const { totals, comparison } = overview;

  const metric = OVERVIEW_METRICS.find((item) => item.key === context.metric) ?? OVERVIEW_METRICS[0]!;
  const period = formatDateRange(context.range.start, context.range.end);

  const seriesPoints: SeriesPoint[] = overview.daily.map((point) => ({
    key: point.date,
    date: point.date,
    value: point[metric.key],
  }));

  return (
    <>
      <PageControls context={context} aggregation={totals.aggregation} />

      <section>
        <div className="section-head">
          <h2>Key metrics</h2>
          <span className="section-note">
            Fine-grain rule: raw stored values summed over the selected range, rounded only for display.
          </span>
        </div>
        <div className="kpi-grid">
          <KpiCard
            label="Gross Sales"
            definition="grossSales"
            value={formatUsd(totals.grossSales)}
            period={period}
            current={totals.grossSales}
            previous={comparison?.totals.grossSales}
          />
          <KpiCard
            label="Revenue Share (internal NET)"
            definition="revenueShare"
            value={formatUsd(totals.revenueShare)}
            period={period}
            current={totals.revenueShare}
            previous={comparison?.totals.revenueShare}
          />
          <KpiCard
            label="Net Units"
            definition="netUnits"
            value={formatUnits(totals.netUnits)}
            period={period}
            current={totals.netUnits}
            previous={comparison?.totals.netUnits}
          />
          <KpiCard
            label="Return Rate"
            definition="returnRate"
            value={formatRate(totals.returnRate)}
            period={period}
            current={totals.returnRate}
            previous={comparison?.totals.returnRate}
            lowerIsBetter
          />
        </div>
        <p className="footnote">
          Gross Units {formatUnits(totals.grossUnits)} · Returned Units {formatUnits(totals.returnedUnitsDisplay)}{' '}
          (stored signed as {formatUnits(totals.returnedUnitsSigned)}).{' '}
          {comparison ? (
            <>
              Comparable period: <span className="mono">{formatDateRange(comparison.range.start, comparison.range.end)}</span>.
            </>
          ) : (
            'No comparable preceding period is available within the warehouse window.'
          )}
        </p>
      </section>

      <section>
        <div className="section-head">
          <h2>
            Daily timeline — {metric.label} <InfoTip definition="fineGrain" />
          </h2>
          <div className="presets">
            {OVERVIEW_METRICS.map((item) => (
              <Link
                key={item.key}
                className="preset"
                aria-current={item.key === metric.key ? 'page' : undefined}
                href={buildHref(context.pathname, context.searchParams, { metric: item.key })}
              >
                {item.label}
              </Link>
            ))}
            <Link
              className="preset"
              aria-current={context.showDiscountOverlay ? 'page' : undefined}
              href={buildHref(context.pathname, context.searchParams, {
                overlay: context.showDiscountOverlay ? 'off' : 'on',
              })}
            >
              Discount overlay
            </Link>
            <Link className="preset" href={buildHref(`/apps/${context.product.appId}/sales`, context.searchParams, { grain: 'monthly' })}>
              Monthly view →
            </Link>
          </div>
        </div>
        <div className="panel panel-pad">
          <TimeSeriesChart
            points={seriesPoints}
            label={metric.label}
            kind={metric.kind}
            discountPeriods={context.showDiscountOverlay ? overview.detectedDiscountPeriods : []}
          />
        </div>
      </section>

      <div className="grid-2">
        <section>
          <div className="section-head">
            <h2>Top countries</h2>
            <Link className="section-note" href={buildHref(`/apps/${context.product.appId}/countries`, context.searchParams, {})}>
              All countries →
            </Link>
          </div>
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Country</th>
                  <th className="num">Gross Sales</th>
                  <th className="num">Net Units</th>
                  <th className="num">Return Rate</th>
                </tr>
              </thead>
              <tbody>
                {overview.topCountries.map((country) => (
                  <tr key={country.countryCode}>
                    <td className="row-name">{country.countryLabel}</td>
                    <td className="num">{formatUsd(country.grossSales)}</td>
                    <td className="num">{formatUnits(country.netUnits)}</td>
                    <td className="num">{formatRate(country.returnRate)}</td>
                  </tr>
                ))}
                {overview.topCountries.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No data</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="section-head">
            <h2>Top DLC</h2>
            <Link className="section-note" href={buildHref(`/apps/${context.product.appId}/dlc`, context.searchParams, {})}>
              All DLC →
            </Link>
          </div>
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>DLC / Package</th>
                  <th className="num">Package ID</th>
                  <th className="num">Gross Sales</th>
                  <th className="num">Gross Units</th>
                </tr>
              </thead>
              <tbody>
                {overview.topDlc.map((dlc) => (
                  <tr key={dlc.packageId}>
                    <td className="row-name">{dlc.packageName}</td>
                    <td className="num">{dlc.packageId}</td>
                    <td className="num">{formatUsd(dlc.grossSales)}</td>
                    <td className="num">{formatUnits(dlc.grossUnits)}</td>
                  </tr>
                ))}
                {overview.topDlc.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No data</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            DLC figures are always scoped to the parent AppID and never folded into the base-product total.
          </p>
        </section>
      </div>

      <section>
        <div className="section-head">
          <h2>Recent detected periods</h2>
          <span className="section-note">
            Derived from observed {PRICING_REFERENCE_MARKET_LABEL} prices. No canonical event source is connected, so
            no event name is shown and no causal relationship is implied.
          </span>
        </div>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Type</th>
                <th className="num">Max observed discount ({PRICING_REFERENCE_MARKET_LABEL})</th>
                <th className="num">Gross Sales</th>
                <th className="num">Gross Units</th>
                <th className="num">Return Rate</th>
                <th>Bundle</th>
              </tr>
            </thead>
            <tbody>
              {overview.detectedDiscountPeriods.map((period) => (
                <tr key={`${period.start}-${period.end}`}>
                  <td className="mono">{formatDateRange(period.start, period.end)}</td>
                  <td>{DETECTED_DISCOUNT_LABEL}</td>
                  <td className="num">{formatPercentPoints(period.maxDiscountPercent)}</td>
                  <td className="num">{formatUsd(period.grossSales)}</td>
                  <td className="num">{formatUnits(period.grossUnits)}</td>
                  <td className="num">{formatRate(period.returnRate)}</td>
                  <td>{period.bundleParticipation ? 'Participating' : '—'}</td>
                </tr>
              ))}
              {overview.detectedDiscountPeriods.length === 0 ? (
                <tr>
                  <td colSpan={7}>No discounted period detected in the selected range.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          Update, news and DLC-release markers require a canonical event source (<code>steam_events</code>), which is
          not connected yet — see <code>docs/OPEN_QUESTIONS.md</code> #4. Only price-derived markers are shown.
        </p>
      </section>
    </>
  );
}
