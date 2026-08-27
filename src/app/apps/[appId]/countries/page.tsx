import Link from 'next/link';
import { PageControls } from '@/components/PageControls';
import { InfoTip } from '@/components/InfoTip';
import { CountryFilters } from '@/components/CountryFilters';
import { formatRate, formatUnits, formatUsd } from '@/domain/format';
import { STEAM_CHINA_LABEL } from '@/domain/country';
import { loadPageContext } from '@/lib/pageContext';
import type { SearchParams } from '@/lib/params';
import type { CountryPerformanceRow } from '@/domain/types';

type SortKey = 'grossSales' | 'revenueShare' | 'grossUnits' | 'returnedUnitsDisplay' | 'returnRate' | 'salesShare';

const SORTABLE: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'grossSales', label: 'Gross Sales' },
  { key: 'revenueShare', label: 'Revenue Share' },
  { key: 'grossUnits', label: 'Gross Units' },
  { key: 'returnedUnitsDisplay', label: 'Returned Units' },
  { key: 'returnRate', label: 'Return Rate' },
  { key: 'salesShare', label: 'Sales Share' },
];

function sortValue(row: CountryPerformanceRow, key: SortKey): number {
  const value = row[key];
  return value === null ? Number.NEGATIVE_INFINITY : value;
}

export default async function CountriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ appId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const context = await loadPageContext(params, searchParams, 'countries');
  const all = await context.repository.getCountryPerformance(context.scope, context.range);

  const sortParam = Array.isArray(context.searchParams.sort)
    ? context.searchParams.sort[0]
    : context.searchParams.sort;
  const sortKey: SortKey = SORTABLE.some((item) => item.key === sortParam) ? (sortParam as SortKey) : 'grossSales';

  const regions = [...new Set(all.map((row) => row.region))].sort();
  const query = context.search.toLowerCase();

  const rows = all
    .filter((row) => (context.region === 'all' ? true : row.region === context.region))
    .filter((row) =>
      query === ''
        ? true
        : row.countryLabel.toLowerCase().includes(query) || row.countryCode.toLowerCase().includes(query),
    )
    .filter((row) => row.grossUnits >= context.minUnits)
    .sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey));

  const totals = rows.reduce(
    (accumulator, row) => ({
      grossSales: accumulator.grossSales + row.grossSales,
      revenueShare: accumulator.revenueShare + row.revenueShare,
      grossUnits: accumulator.grossUnits + row.grossUnits,
      returnedUnitsSigned: accumulator.returnedUnitsSigned + row.returnedUnitsSigned,
      salesShare: accumulator.salesShare + (row.salesShare ?? 0),
    }),
    { grossSales: 0, revenueShare: 0, grossUnits: 0, returnedUnitsSigned: 0, salesShare: 0 },
  );

  return (
    <>
      <PageControls context={context} aggregation="fine-grain" />

      <section>
        <div className="section-head">
          <h2>
            Country performance <InfoTip definition="fineGrain" />
          </h2>
          <span className="section-note">
            {rows.length} of {all.length} countries shown · Country is a fine-grain grain, so monetary columns are raw
            sums.
          </span>
        </div>

        <CountryFilters
          regions={regions}
          activeRegion={context.region}
          search={context.search}
          minUnits={context.minUnits}
          sortKey={sortKey}
          sortOptions={SORTABLE}
        />

        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Country</th>
                <th>Region</th>
                <th className="num">Gross Sales</th>
                <th className="num">Revenue Share</th>
                <th className="num">Gross Units</th>
                <th className="num">Returned Units</th>
                <th className="num">Return Rate</th>
                <th className="num">Sales Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.countryCode}>
                  <td className="row-name">{row.countryLabel}</td>
                  <td>{row.region}</td>
                  <td className="num">{formatUsd(row.grossSales)}</td>
                  <td className="num">{formatUsd(row.revenueShare)}</td>
                  <td className="num">{formatUnits(row.grossUnits)}</td>
                  <td className="num">{formatUnits(row.returnedUnitsDisplay)}</td>
                  <td className="num">{formatRate(row.returnRate)}</td>
                  <td className="num">{formatRate(row.salesShare)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>No data for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={2}>Total of listed rows</td>
                  <td className="num">{formatUsd(totals.grossSales)}</td>
                  <td className="num">{formatUsd(totals.revenueShare)}</td>
                  <td className="num">{formatUnits(totals.grossUnits)}</td>
                  <td className="num">{formatUnits(-totals.returnedUnitsSigned)}</td>
                  <td className="num">
                    {formatRate(totals.grossUnits === 0 ? null : -totals.returnedUnitsSigned / totals.grossUnits)}
                  </td>
                  <td className="num">{formatRate(totals.salesShare)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <p className="footnote">
          <code>XC</code> / <code>Unknown Country</code> is Steam China and is displayed as
          <strong> {STEAM_CHINA_LABEL}</strong>. Revenue Share here is the row-level warehouse value summed under the
          fine-grain rule; the calendar-month Revenue Share rule applies only to whole-month aggregation and is shown on{' '}
          <Link href={`/apps/${context.product.appId}/sales?grain=monthly`}>Sales → Calendar month</Link>.
        </p>
      </section>
    </>
  );
}
