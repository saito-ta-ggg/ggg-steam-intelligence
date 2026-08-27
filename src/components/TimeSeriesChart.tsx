import { formatUnits, formatUsd } from '@/domain/format';
import { PRICING_REFERENCE_MARKET_LABEL } from '@/domain/pricing';
import type { DetectedDiscountPeriod } from '@/domain/types';

export interface SeriesPoint {
  /** Category key: an ISO date, `YYYY-MM` or an FY label. */
  readonly key: string;
  readonly value: number;
  /** Ordering/positioning date, used to place discount overlay bands. */
  readonly date: string;
}

interface TimeSeriesChartProps {
  readonly points: readonly SeriesPoint[];
  readonly label: string;
  readonly kind: 'money' | 'units';
  /**
   * Detected discounted periods drawn as background bands. These are observed
   * price stretches, never named events, and no causal claim is made.
   */
  readonly discountPeriods?: readonly DetectedDiscountPeriod[];
}

const WIDTH = 1000;
const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 74 };

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

/**
 * Server-rendered SVG time series. No charting dependency and no client
 * JavaScript: values are exposed through <title> so every bar is inspectable.
 */
export function TimeSeriesChart({ points, label, kind, discountPeriods = [] }: TimeSeriesChartProps) {
  if (points.length === 0) {
    return <p className="section-note">No data for the selected range and scope.</p>;
  }

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const maxValue = niceCeiling(Math.max(...points.map((point) => point.value), 0));
  const bandWidth = plotWidth / points.length;
  const barWidth = Math.max(1, bandWidth * 0.82);

  const format = kind === 'money' ? formatUsd : formatUnits;
  const indexByDate = new Map(points.map((point, index) => [point.date, index] as const));

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => ({
    fraction,
    y: PAD.top + plotHeight * (1 - fraction),
    value: maxValue * fraction,
  }));

  // Overlay bands: only periods that intersect the plotted keys are drawn.
  const bands = discountPeriods
    .map((period) => {
      let startIndex: number | undefined;
      let endIndex: number | undefined;
      for (const [date, index] of indexByDate) {
        if (date >= period.start && date <= period.end) {
          if (startIndex === undefined || index < startIndex) startIndex = index;
          if (endIndex === undefined || index > endIndex) endIndex = index;
        }
      }
      if (startIndex === undefined || endIndex === undefined) return null;
      return { period, startIndex, endIndex };
    })
    .filter((band): band is NonNullable<typeof band> => band !== null);

  const tickEvery = Math.max(1, Math.ceil(points.length / 12));

  return (
    <>
      <svg
        className="chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} by period`}
      >
        {bands.map((band) => (
          <rect
            key={`${band.period.start}-${band.period.end}`}
            x={PAD.left + band.startIndex * bandWidth}
            y={PAD.top}
            width={(band.endIndex - band.startIndex + 1) * bandWidth}
            height={plotHeight}
            fill="#d2992224"
            stroke="#d2992240"
          >
            <title>{`Detected discounted period ${band.period.start} – ${band.period.end} (observed effective discount up to ${band.period.maxDiscountPercent.toFixed(2)}% in ${PRICING_REFERENCE_MARKET_LABEL})`}</title>
          </rect>
        ))}

        {gridLines.map((line) => (
          <g key={line.fraction}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={line.y} y2={line.y} stroke="#262f3d" strokeWidth={1} />
            <text x={PAD.left - 8} y={line.y + 4} textAnchor="end" fontSize={10} fill="#6b7482" fontFamily="ui-monospace, monospace">
              {kind === 'money' ? formatUsd(line.value) : formatUnits(line.value)}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const height = maxValue === 0 ? 0 : (point.value / maxValue) * plotHeight;
          const safeHeight = Number.isFinite(height) ? Math.max(0, height) : 0;
          return (
            <rect
              key={point.key}
              x={PAD.left + index * bandWidth + (bandWidth - barWidth) / 2}
              y={PAD.top + plotHeight - safeHeight}
              width={barWidth}
              height={safeHeight}
              fill="#4c8dff"
              opacity={0.85}
            >
              <title>{`${point.key} — ${label}: ${format(point.value)}`}</title>
            </rect>
          );
        })}

        {points.map((point, index) =>
          index % tickEvery === 0 ? (
            <text
              key={`tick-${point.key}`}
              x={PAD.left + index * bandWidth + bandWidth / 2}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize={10}
              fill="#6b7482"
              fontFamily="ui-monospace, monospace"
            >
              {point.key}
            </text>
          ) : null,
        )}
      </svg>

      <div className="chart-legend">
        <span>
          <span className="legend-swatch" style={{ background: '#4c8dff' }} />
          {label}
        </span>
        {bands.length > 0 ? (
          <span>
            <span className="legend-swatch" style={{ background: '#d2992240', border: '1px solid #d29922' }} />
            {`Detected discounted period — ${PRICING_REFERENCE_MARKET_LABEL} observed price only, no event name or causal claim`}
          </span>
        ) : null}
      </div>
    </>
  );
}
