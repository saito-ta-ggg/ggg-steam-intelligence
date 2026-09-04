import { eachDate } from '@/domain/dates';
import { formatPercentPoints, formatUnits, formatUsd } from '@/domain/format';
import type { TimelineLayer, TimelineLayerId, TimelineMarker, UnifiedTimeline } from '@/domain/timeline';

const WIDTH = 1000;
const ROW_HEIGHT = 44;
const ROW_PAD = { top: 5, bottom: 5 };
const PLOT_HEIGHT = ROW_HEIGHT - ROW_PAD.top - ROW_PAD.bottom;

interface SeriesPoint {
  readonly date: string;
  readonly value: number | null;
}

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatByUnit(value: number, unit: TimelineLayer['unit']): string {
  switch (unit) {
    case 'usd':
      return formatUsd(value);
    case 'units':
      return formatUnits(value);
    case 'percent':
      return formatPercentPoints(value);
    case 'players':
      return `${formatUnits(value)} players`;
    case 'score':
    case 'count':
      return formatUnits(value);
  }
}

/** Builds an x/y for a series index, sharing one scale across a row. */
function makeProjector(seriesLength: number, maxValue: number) {
  const bandWidth = WIDTH / Math.max(1, seriesLength);
  return (index: number, value: number) => {
    const x = index * bandWidth + bandWidth / 2;
    const height = maxValue === 0 ? 0 : (value / maxValue) * PLOT_HEIGHT;
    const y = ROW_PAD.top + PLOT_HEIGHT - Math.max(0, Number.isFinite(height) ? height : 0);
    return { x, y, bandWidth };
  };
}

function BarRow({ series, unit }: { series: readonly SeriesPoint[]; unit: TimelineLayer['unit'] }) {
  const numericValues = series.map((point) => point.value).filter((value): value is number => value !== null);
  if (numericValues.length === 0) return <p className="section-note">No data for the selected range.</p>;

  const maxValue = niceCeiling(Math.max(...numericValues, 0));
  const project = makeProjector(series.length, maxValue);

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${ROW_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Daily values">
      {series.map((point, index) => {
        if (point.value === null) return null;
        const { x, y, bandWidth } = project(index, point.value);
        const barWidth = Math.max(1, bandWidth * 0.82);
        const height = ROW_PAD.top + PLOT_HEIGHT - y;
        return (
          <rect key={point.date} x={x - barWidth / 2} y={y} width={barWidth} height={height} fill="#4c8dff" opacity={0.85}>
            <title>{`${point.date}: ${formatByUnit(point.value, unit)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function LineRow({ series, unit }: { series: readonly SeriesPoint[]; unit: TimelineLayer['unit'] }) {
  const numericValues = series.map((point) => point.value).filter((value): value is number => value !== null);
  if (numericValues.length === 0) return <p className="section-note">No data for the selected range.</p>;

  const maxValue = niceCeiling(Math.max(...numericValues, 0));
  const project = makeProjector(series.length, maxValue);

  // Segments break a polyline at null gaps rather than interpolating over missing data.
  type PlottedPoint = { date: string; value: number; x: number; y: number };
  const segments: PlottedPoint[][] = [];
  let current: PlottedPoint[] = [];
  series.forEach((point, index) => {
    if (point.value === null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    const { x, y } = project(index, point.value);
    current.push({ date: point.date, value: point.value, x, y });
  });
  if (current.length > 0) segments.push(current);

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${ROW_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Daily values">
      {segments.map((segment, segmentIndex) => (
        <polyline
          key={segmentIndex}
          points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke="#4c8dff"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {segments.flat().map((point) => (
        <circle key={point.date} cx={point.x} cy={point.y} r={1.6} fill="#4c8dff">
          <title>{`${point.date}: ${formatByUnit(point.value, unit)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function MarkerRow({ series, markers }: { series: readonly SeriesPoint[]; markers: readonly TimelineMarker[] }) {
  if (markers.length === 0) return <p className="section-note">No markers for the selected range.</p>;
  const indexByDate = new Map(series.map((point, index) => [point.date, index] as const));
  const project = makeProjector(series.length, 1);
  const midY = ROW_PAD.top + PLOT_HEIGHT / 2;

  return (
    <svg className="chart" viewBox={`0 0 ${WIDTH} ${ROW_HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Event markers">
      <line x1={0} x2={WIDTH} y1={midY} y2={midY} stroke="#262f3d" strokeWidth={1} />
      {markers.map((marker) => {
        const index = indexByDate.get(marker.date);
        if (index === undefined) return null;
        const { x } = project(index, 0);
        return (
          <circle key={`${marker.date}-${marker.label}`} cx={x} cy={midY} r={3.5} fill="#a371f7">
            <title>{`${marker.date} — ${marker.label}`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function NotConnectedRow({ reason }: { reason: string }) {
  return (
    <div className="timeline-not-connected">
      <span className="badge">Not connected</span> {reason}
    </div>
  );
}

function statusBadge(layer: TimelineLayer) {
  if (layer.availability.status === 'not_connected') {
    return <span className="badge">Not connected</span>;
  }
  return layer.availability.source === 'mock' ? (
    <span className="badge badge-mock">Mock fixtures</span>
  ) : (
    <span className="badge">BigQuery</span>
  );
}

/**
 * Server-rendered, multi-layer "swimlane" timeline. Every enabled layer gets
 * its own row sharing one date axis (docs `UI_SPEC.md`/this issue: visualization
 * is the primary analytical surface; exact-value tables live elsewhere).
 * A `not_connected` layer always renders as a clearly labelled placeholder —
 * it is never silently dropped or filled with a fabricated value.
 */
export function UnifiedTimelineChart({
  timeline,
  enabledLayerIds,
}: {
  readonly timeline: UnifiedTimeline;
  readonly enabledLayerIds: readonly TimelineLayerId[];
}) {
  const dates = eachDate(timeline.range);
  const enabled = new Set(enabledLayerIds);
  const rows = timeline.layers.filter((layer) => enabled.has(layer.id));

  if (rows.length === 0) {
    return <p className="section-note">No layers selected. Choose at least one layer from the legend below.</p>;
  }

  return (
    <div className="timeline-rows">
      {rows.map((layer) => {
        const byDate = new Map(layer.points.map((point) => [point.date, point.value] as const));
        const series: SeriesPoint[] = dates.map((date) => ({ date, value: byDate.get(date) ?? null }));

        return (
          <div className="timeline-row" key={layer.id}>
            <div className="timeline-row-head">
              <span className="timeline-row-label">{layer.label}</span>
              {statusBadge(layer)}
            </div>
            {layer.availability.status === 'not_connected' ? (
              <NotConnectedRow reason={layer.availability.reason} />
            ) : layer.render === 'bar' ? (
              <BarRow series={series} unit={layer.unit} />
            ) : layer.render === 'line' ? (
              <LineRow series={series} unit={layer.unit} />
            ) : (
              <MarkerRow series={series} markers={layer.markers} />
            )}
          </div>
        );
      })}
      <p className="footnote">
        {dates.length} days in range · one row per layer, sharing the same date axis · hover a bar, point or marker
        for its exact value.
      </p>
    </div>
  );
}
