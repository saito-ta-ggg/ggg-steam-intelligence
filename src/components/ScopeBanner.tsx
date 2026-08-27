import { formatDateRange } from '@/domain/format';
import { describeScope } from '@/domain/scope';
import type { DataFreshness, DateRange, MonetaryAggregation, Scope } from '@/domain/types';

/**
 * UI_SPEC.md safeguard: the active date range and scope are always shown, and the
 * data source and freshness are surfaced whenever they are known.
 */
export function ScopeBanner({
  scope,
  range,
  freshness,
  aggregation,
}: {
  readonly scope: Scope;
  readonly range: DateRange;
  readonly freshness: DataFreshness;
  readonly aggregation?: MonetaryAggregation;
}) {
  return (
    <div className="scope-banner">
      <span>
        <strong>Scope</strong> {describeScope(scope)}
      </span>
      <span>
        <strong>Range</strong> <span className="mono">{formatDateRange(range.start, range.end)}</span> (Steam
        financial calculation date, Pacific Time)
      </span>
      {aggregation ? (
        <span>
          <strong>Monetary rule</strong>{' '}
          {aggregation === 'calendar-month' ? 'Calendar-month (TRUNC per package-month)' : 'Fine-grain (raw sums)'}
        </span>
      ) : null}
      <span>
        {freshness.source === 'mock' ? (
          <span className="badge badge-mock">Mock fixtures — not GGG actuals</span>
        ) : (
          <span className="badge">BigQuery</span>
        )}
      </span>
      {freshness.latestDate ? (
        <span>
          <strong>Data through</strong> <span className="mono">{freshness.latestDate}</span>
        </span>
      ) : null}
    </div>
  );
}
