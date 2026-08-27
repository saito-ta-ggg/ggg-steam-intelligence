import { PageControls } from '@/components/PageControls';
import { InfoTip } from '@/components/InfoTip';
import { formatDateRange, formatMinorUnits, formatPercentPoints, formatRate, formatUnits, formatUsd } from '@/domain/format';
import { DETECTED_DISCOUNT_LABEL } from '@/domain/pricing';
import { loadPageContext } from '@/lib/pageContext';
import type { SearchParams } from '@/lib/params';

export default async function PricingPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'pricing');
  const timeline = await context.repository.getPricingTimeline(context.scope, context.range);
  const periods = [...timeline.periods].reverse();

  return (
    <>
      <PageControls context={context} aggregation="fine-grain" />

      <div className="notice">
        No canonical sale/event dataset is connected (<code>docs/OPEN_QUESTIONS.md</code> #4), so every row below is
        labelled <strong>{DETECTED_DISCOUNT_LABEL}</strong>. Sale names are never inferred, and no causal relationship
        between a discount and a change in sales is asserted.
      </div>

      <section>
        <div className="section-head">
          <h2>
            Detected discounted periods <InfoTip definition="effectiveDiscount" />
          </h2>
          <span className="section-note">
            Prices are local-currency minor units taken from the highest-volume observation of each day.
          </span>
        </div>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Label</th>
                <th className="num">Base price</th>
                <th className="num">Sale price</th>
                <th className="num">Observed effective discount</th>
                <th className="num">Gross Units</th>
                <th className="num">Gross Sales</th>
                <th className="num">Return Rate</th>
                <th>Bundle</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={`${period.start}-${period.end}`}>
                  <td className="mono">{formatDateRange(period.start, period.end)}</td>
                  <td>{DETECTED_DISCOUNT_LABEL}</td>
                  <td className="num">{formatMinorUnits(period.basePrice, period.currency)}</td>
                  <td className="num">{formatMinorUnits(period.salePrice, period.currency)}</td>
                  <td className="num">{formatPercentPoints(period.maxDiscountPercent)}</td>
                  <td className="num">{formatUnits(period.grossUnits)}</td>
                  <td className="num">{formatUsd(period.grossSales)}</td>
                  <td className="num">{formatRate(period.returnRate)}</td>
                  <td>{period.bundleParticipation ? 'Participating' : '—'}</td>
                </tr>
              ))}
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={9}>No discounted period detected in the selected range.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="footnote">
          The discount shown is the observed effective discount, 100 × (base_price − sale_price) / base_price, rather
          than <code>total_discount_percentage</code> alone, which can miss bundle adjustments. Bundle participation is
          reported separately because <code>bundleid IS NOT NULL</code> on its own does not prove a discount.
        </p>
      </section>

      <section>
        <div className="section-head">
          <h2>Daily price observations</h2>
          <span className="section-note">{timeline.points.length} days in range</span>
        </div>
        <div className="panel table-wrap" style={{ maxHeight: 480, overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Base price</th>
                <th className="num">Sale price</th>
                <th className="num">Observed effective discount</th>
                <th className="num">Reported total_discount_percentage</th>
                <th>Bundle</th>
              </tr>
            </thead>
            <tbody>
              {timeline.points.map((point) => (
                <tr key={point.date}>
                  <td className="mono">{point.date}</td>
                  <td className="num">{formatMinorUnits(point.basePrice, point.currency)}</td>
                  <td className="num">{formatMinorUnits(point.salePrice, point.currency)}</td>
                  <td className="num">{formatPercentPoints(point.effectiveDiscountPercent)}</td>
                  <td className="num">{formatPercentPoints(point.totalDiscountPercentage)}</td>
                  <td>{point.bundleParticipation ? 'Participating' : '—'}</td>
                </tr>
              ))}
              {timeline.points.length === 0 ? (
                <tr>
                  <td colSpan={6}>No data</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
