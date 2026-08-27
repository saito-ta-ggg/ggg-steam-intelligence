import Link from 'next/link';
import { PageControls } from '@/components/PageControls';
import { InfoTip } from '@/components/InfoTip';
import { DlcFilters } from '@/components/DlcFilters';
import { formatRate, formatUnits, formatUsd } from '@/domain/format';
import { loadPageContext } from '@/lib/pageContext';
import type { SearchParams } from '@/lib/params';
import type { DlcPerformanceRow, PackageKind } from '@/domain/types';

type SortKey = 'grossSales' | 'grossUnits' | 'returnedUnitsDisplay' | 'returnRate' | 'revenueShare' | 'packageId';

const SORTABLE: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'grossSales', label: 'Gross Sales' },
  { key: 'grossUnits', label: 'Gross Units' },
  { key: 'returnedUnitsDisplay', label: 'Returned Units' },
  { key: 'returnRate', label: 'Return Rate' },
  { key: 'revenueShare', label: 'Revenue Share' },
  { key: 'packageId', label: 'Package ID' },
];

const KIND_FILTERS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'dlc', label: 'DLC only' },
  { id: 'all', label: 'All packages' },
  { id: 'base', label: 'Base packages' },
  { id: 'bundle', label: 'Bundles' },
];

function sortValue(row: DlcPerformanceRow, key: SortKey): number {
  const value = row[key];
  return value === null ? Number.NEGATIVE_INFINITY : value;
}

function kindBadge(kind: PackageKind) {
  const className = kind === 'base' ? 'badge badge-base' : kind === 'bundle' ? 'badge badge-bundle' : 'badge badge-dlc';
  return <span className={className}>{kind}</span>;
}

export default async function DlcPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'dlc');
  // Resolved against the parent AppID, independently of the page scope. This is the
  // all-packages query because the table labels each row's kind and offers a base /
  // bundle / DLC filter; the default filter below is DLC, and `getDlcPerformance`
  // is what every DLC-only surface (e.g. Overview's top DLC) uses instead.
  const all = await context.repository.getPackagePerformance(context.product.appId, context.range);

  const rawSort = Array.isArray(context.searchParams.sort) ? context.searchParams.sort[0] : context.searchParams.sort;
  const sortKey: SortKey = SORTABLE.some((item) => item.key === rawSort) ? (rawSort as SortKey) : 'grossSales';
  const rawKind = Array.isArray(context.searchParams.kind) ? context.searchParams.kind[0] : context.searchParams.kind;
  const kind = KIND_FILTERS.some((item) => item.id === rawKind) ? rawKind! : 'dlc';

  const query = context.search.toLowerCase();
  const rows = all
    .filter((row) => (kind === 'all' ? true : row.kind === kind))
    .filter((row) =>
      query === '' ? true : row.packageName.toLowerCase().includes(query) || String(row.packageId).includes(query),
    )
    .filter((row) => row.grossUnits >= context.minUnits)
    .sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey));

  const totals = rows.reduce(
    (accumulator, row) => ({
      grossSales: accumulator.grossSales + row.grossSales,
      revenueShare: accumulator.revenueShare + row.revenueShare,
      grossUnits: accumulator.grossUnits + row.grossUnits,
      returnedUnitsSigned: accumulator.returnedUnitsSigned + row.returnedUnitsSigned,
    }),
    { grossSales: 0, revenueShare: 0, grossUnits: 0, returnedUnitsSigned: 0 },
  );

  return (
    <>
      <PageControls context={context} aggregation="fine-grain" />

      <div className="notice">
        This table lists packages under <strong>AppID {context.product.appId}</strong> and is therefore independent of
        the Scope control above. Base packages ({context.product.basePackageIds.join(', ')}) are labelled so they are
        never mistaken for DLC, and a base package is never inferred from <code>primary_appid</code> alone.
      </div>

      <section>
        <div className="section-head">
          <h2>
            Package / DLC performance <InfoTip definition="fineGrain" />
          </h2>
          <span className="section-note">
            {rows.length} of {all.length} packages shown
          </span>
        </div>

        <DlcFilters
          search={context.search}
          minUnits={context.minUnits}
          sortKey={sortKey}
          sortOptions={SORTABLE}
          kind={kind}
          kindOptions={KIND_FILTERS}
        />

        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>DLC / Package</th>
                <th className="num">Package ID</th>
                <th>Type</th>
                <th className="num">Gross Sales</th>
                <th className="num">Gross Units</th>
                <th className="num">Returned Units</th>
                <th className="num">Return Rate</th>
                <th className="num">Revenue Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.packageId}>
                  <td className="row-name">
                    <Link href={`/apps/${context.product.appId}/dlc/${row.packageId}`}>{row.packageName}</Link>
                  </td>
                  <td className="num">{row.packageId}</td>
                  <td>{kindBadge(row.kind)}</td>
                  <td className="num">{formatUsd(row.grossSales)}</td>
                  <td className="num">{formatUnits(row.grossUnits)}</td>
                  <td className="num">{formatUnits(row.returnedUnitsDisplay)}</td>
                  <td className="num">{formatRate(row.returnRate)}</td>
                  <td className="num">{formatUsd(row.revenueShare)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>No packages match the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total of listed rows</td>
                  <td className="num">{formatUsd(totals.grossSales)}</td>
                  <td className="num">{formatUnits(totals.grossUnits)}</td>
                  <td className="num">{formatUnits(-totals.returnedUnitsSigned)}</td>
                  <td className="num">
                    {formatRate(totals.grossUnits === 0 ? null : -totals.returnedUnitsSigned / totals.grossUnits)}
                  </td>
                  <td className="num">{formatUsd(totals.revenueShare)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <p className="footnote">
          Cross-title DLC comparison (for example MV against MZ) is intentionally left to a later phase; the catalogue
          in <code>src/domain/scope.ts</code> already carries both titles and their Package families so the comparison
          can be added without changing the metric layer.
        </p>
      </section>
    </>
  );
}
