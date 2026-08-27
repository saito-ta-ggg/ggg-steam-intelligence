import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageControls } from '@/components/PageControls';
import { KpiCard } from '@/components/KpiCard';
import { EmptyState } from '@/components/EmptyState';
import { formatDateRange, formatRate, formatUnits, formatUsd } from '@/domain/format';
import { previousRange } from '@/domain/dates';
import { loadPageContext } from '@/lib/pageContext';
import type { SearchParams } from '@/lib/params';

/**
 * Package detail. Deliberately minimal for Phase 1: it shows the figures that
 * exist today and names the sources that are not connected yet, rather than
 * filling the page with placeholder values.
 */
export default async function PackageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string; packageId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { packageId: packageIdParam } = await params;
  const packageId = Number(packageIdParam);
  const context = await loadPageContext(
    params.then(({ appId }) => ({ appId })),
    searchParams,
    'dlc',
  );

  const rows = await context.repository.getDlcPerformance(context.product.appId, context.range);
  const row = rows.find((item) => item.packageId === packageId);
  if (!row) notFound();

  const priorRows = await context.repository.getDlcPerformance(context.product.appId, previousRange(context.range));
  const prior = priorRows.find((item) => item.packageId === packageId);
  const period = formatDateRange(context.range.start, context.range.end);

  return (
    <>
      <PageControls context={context} aggregation="fine-grain" />

      <section>
        <div className="section-head">
          <h2>
            {row.packageName} <span className="appid">Package {row.packageId}</span>{' '}
            <span className={`badge badge-${row.kind}`}>{row.kind}</span>
          </h2>
          <Link className="section-note" href={`/apps/${context.product.appId}/dlc`}>
            ← Back to package list
          </Link>
        </div>
        <div className="kpi-grid">
          <KpiCard label="Gross Sales" definition="grossSales" value={formatUsd(row.grossSales)} period={period} current={row.grossSales} previous={prior?.grossSales} />
          <KpiCard label="Revenue Share (internal NET)" definition="revenueShare" value={formatUsd(row.revenueShare)} period={period} current={row.revenueShare} previous={prior?.revenueShare} />
          <KpiCard label="Gross Units" definition="grossUnits" value={formatUnits(row.grossUnits)} period={period} current={row.grossUnits} previous={prior?.grossUnits} />
          <KpiCard label="Returned Units" definition="returnedUnits" value={formatUnits(row.returnedUnitsDisplay)} period={period} current={row.returnedUnitsDisplay} previous={prior?.returnedUnitsDisplay} lowerIsBetter />
          <KpiCard label="Net Units" definition="netUnits" value={formatUnits(row.netUnits)} period={period} current={row.netUnits} previous={prior?.netUnits} />
          <KpiCard label="Return Rate" definition="returnRate" value={formatRate(row.returnRate)} period={period} current={row.returnRate} previous={prior?.returnRate} lowerIsBetter />
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>Store context</h2>
        </div>
        <EmptyState
          title="Store metadata is not connected"
          description="Release date, languages, store images and cross-title DLC comparison need a canonical store-metadata source, which does not exist yet."
          requirements={[
            'docs/OPEN_QUESTIONS.md #3 — canonical source for release dates, languages, images and store metadata',
            'docs/DATA_MODEL.md — provisional table steam_store_snapshot',
            'docs/REQUIREMENTS.md — MV/MZ related-DLC comparison is a future design requirement',
          ]}
        />
      </section>
    </>
  );
}
