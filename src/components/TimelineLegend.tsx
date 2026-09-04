import Link from 'next/link';
import { TIMELINE_LAYER_ORDER, type TimelineLayerId, type UnifiedTimeline } from '@/domain/timeline';

/**
 * Layer toggles + legend. Every layer this contract can represent is listed,
 * including the ones with no data source yet — toggling one on shows its
 * "Not connected" placeholder, which is the point: the intended combined
 * visualization is evaluable now, even before Review/Store/CCU/event data
 * exists (this issue's acceptance criterion).
 */
export function TimelineLegend({
  timeline,
  enabledLayerIds,
  pathname,
  buildLayersHref,
}: {
  readonly timeline: UnifiedTimeline;
  readonly enabledLayerIds: readonly TimelineLayerId[];
  readonly pathname: string;
  readonly buildLayersHref: (nextEnabled: readonly TimelineLayerId[]) => string;
}) {
  const enabled = new Set(enabledLayerIds);
  const byId = new Map(timeline.layers.map((layer) => [layer.id, layer] as const));

  return (
    <div className="presets" role="group" aria-label="Timeline layers">
      {TIMELINE_LAYER_ORDER.map((id) => {
        const layer = byId.get(id);
        if (!layer) return null;
        const isOn = enabled.has(id);
        const next = isOn ? enabledLayerIds.filter((layerId) => layerId !== id) : [...enabledLayerIds, id];
        const notConnected = layer.availability.status === 'not_connected';

        return (
          <Link
            key={id}
            className={`preset${notConnected ? ' preset-muted' : ''}`}
            aria-current={isOn ? 'page' : undefined}
            href={buildLayersHref(next)}
            title={layer.availability.status === 'not_connected' ? layer.availability.reason : undefined}
          >
            {layer.label}
            {notConnected ? ' (not connected)' : ''}
          </Link>
        );
      })}
      <Link className="preset" href={pathname}>
        Reset layers
      </Link>
    </div>
  );
}
