import { formatSignedRate, relativeDelta } from '@/domain/format';
import { InfoTip } from './InfoTip';
import type { DefinitionKey } from './Definitions';

interface KpiCardProps {
  readonly label: string;
  readonly value: string;
  readonly definition: DefinitionKey;
  /** The period the value covers, always displayed (UI_SPEC.md). */
  readonly period: string;
  /** Raw current/previous values for the comparable-period delta, when available. */
  readonly current?: number | null;
  readonly previous?: number | null;
  /** True when a fall in the metric is the good outcome (e.g. Return Rate). */
  readonly lowerIsBetter?: boolean;
}

export function KpiCard({
  label,
  value,
  definition,
  period,
  current,
  previous,
  lowerIsBetter = false,
}: KpiCardProps) {
  const delta =
    current === null || current === undefined || previous === null || previous === undefined
      ? null
      : relativeDelta(current, previous);

  const tone =
    delta === null || delta === 0
      ? 'neutral'
      : (delta > 0) !== lowerIsBetter
        ? 'up'
        : 'down';

  return (
    <div className="kpi">
      <div className="kpi-label">
        {label}
        <InfoTip definition={definition} />
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-meta">{period}</div>
      {delta === null ? (
        <div className="kpi-delta neutral">No comparable period</div>
      ) : (
        <div className={`kpi-delta ${tone}`}>{formatSignedRate(delta)} vs. previous period</div>
      )}
    </div>
  );
}
