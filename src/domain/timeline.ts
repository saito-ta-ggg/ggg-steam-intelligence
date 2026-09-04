/**
 * Unified timeline contract (Phase 2A).
 *
 * A single shape every layer of the combined Steam Intelligence timeline uses,
 * whether this repository can currently supply it (GGG sales/units/return
 * rate, price/discount — all derived from `detailed_sales`) or not (CCU,
 * reviews, update/promotion/event markers). A layer with no source yet is
 * represented as `not_connected`, never filled with an invented or
 * mocked-as-real value (CLAUDE.md: "never invent financial formulas" /
 * docs/UI_SPEC.md: "Missing data is No data, not zero").
 *
 * Adding a real source later (Review API, Store API, a CCU feed, a canonical
 * events table) means adding one builder that produces this same
 * `TimelineLayer` shape with `availability.status === 'connected'` — the
 * chart component and the page that assembles the timeline do not change.
 */
import { PRICING_REFERENCE_MARKET_LABEL } from './pricing';
import type { DailySalesPoint, DateRange, PricingTimeline } from './types';

export type TimelineLayerId =
  | 'grossSales'
  | 'netUnits'
  | 'returnRate'
  | 'price'
  | 'discount'
  | 'ccu'
  | 'reviews'
  | 'events';

/** How the chart draws a layer. Markers are discrete dated events, not a continuous series. */
export type TimelineRenderKind = 'bar' | 'line' | 'marker';

export type TimelineValueUnit = 'usd' | 'units' | 'percent' | 'players' | 'score' | 'count';

export interface TimelinePoint {
  readonly date: string;
  /** `null` means no observation for that date — rendered as a gap, never as zero. */
  readonly value: number | null;
}

export interface TimelineMarker {
  readonly date: string;
  readonly label: string;
}

/**
 * `connected`: this repository (mock or bigquery) actually produced the
 * layer's points/markers for the requested scope and range.
 * `not_connected`: no data source exists in this codebase yet; `points` and
 * `markers` are always empty and `reason` names the missing dataset (see
 * docs/DATA_MODEL.md "Future tables" and docs/OPEN_QUESTIONS.md).
 */
export type TimelineAvailability =
  | { readonly status: 'connected'; readonly source: 'mock' | 'bigquery' }
  | { readonly status: 'not_connected'; readonly reason: string };

export interface TimelineLayer {
  readonly id: TimelineLayerId;
  readonly label: string;
  readonly render: TimelineRenderKind;
  readonly unit: TimelineValueUnit;
  readonly availability: TimelineAvailability;
  readonly points: readonly TimelinePoint[];
  readonly markers: readonly TimelineMarker[];
}

export interface UnifiedTimeline {
  readonly range: DateRange;
  readonly layers: readonly TimelineLayer[];
}

/** Fixed order every surface uses when listing layers, so the legend and the chart never disagree. */
export const TIMELINE_LAYER_ORDER: readonly TimelineLayerId[] = [
  'grossSales',
  'netUnits',
  'returnRate',
  'price',
  'discount',
  'ccu',
  'reviews',
  'events',
];

/** Layers shown enabled by default: the two the current repository can actually supply. */
export const DEFAULT_ENABLED_TIMELINE_LAYERS: readonly TimelineLayerId[] = ['grossSales', 'discount'];

interface NotConnectedLayerDefinition {
  readonly id: TimelineLayerId;
  readonly label: string;
  readonly render: TimelineRenderKind;
  readonly unit: TimelineValueUnit;
  readonly reason: string;
}

/**
 * Layers with no table in this repository yet, Phase 2A. Nothing here is
 * queried or fabricated — this is the static description of what plugs in
 * later, and why it is empty now.
 */
const NOT_CONNECTED_LAYER_DEFINITIONS: readonly NotConnectedLayerDefinition[] = [
  {
    id: 'ccu',
    label: 'Concurrent players (CCU)',
    render: 'line',
    unit: 'players',
    reason:
      'No CCU source is connected. The Steamworks partner financial feed detailed_sales does not carry CCU. A provisional steam_ccu_snapshot table is proposed in docs/DATA_MODEL.md; see docs/OPEN_QUESTIONS.md #19.',
  },
  {
    id: 'reviews',
    label: 'Reviews',
    render: 'line',
    unit: 'score',
    reason:
      'Review API is not connected. See the provisional steam_reviews / steam_review_daily_snapshot tables in docs/DATA_MODEL.md and docs/OPEN_QUESTIONS.md #5.',
  },
  {
    id: 'events',
    label: 'Updates / promotions / events',
    render: 'marker',
    unit: 'count',
    reason:
      'No canonical event source is connected. Detected discounted periods (the discount layer) are the one price-derived signal available today; named update/news/DLC-release markers require the provisional steam_events table in docs/DATA_MODEL.md — see docs/OPEN_QUESTIONS.md #4 and #7.',
  },
];

function notConnectedLayer(definition: NotConnectedLayerDefinition): TimelineLayer {
  return {
    id: definition.id,
    label: definition.label,
    render: definition.render,
    unit: definition.unit,
    availability: { status: 'not_connected', reason: definition.reason },
    points: [],
    markers: [],
  };
}

export interface BuildUnifiedTimelineParams {
  readonly range: DateRange;
  readonly source: 'mock' | 'bigquery';
  /** Fine-grain daily sales, e.g. from `SalesRepository.getDailySales`. */
  readonly daily: readonly DailySalesPoint[];
  /** From `SalesRepository.getPricingTimeline`. */
  readonly pricing: PricingTimeline;
}

/**
 * Assembles the unified timeline from data this repository can legitimately
 * supply today plus the fixed set of not-yet-connected layers above. Contains
 * no SQL and performs no I/O — callers pass in results already fetched
 * through `SalesRepository`.
 */
export function buildUnifiedTimeline(params: BuildUnifiedTimelineParams): UnifiedTimeline {
  const { range, source, daily, pricing } = params;
  const availability: TimelineAvailability = { status: 'connected', source };

  const grossSales: TimelineLayer = {
    id: 'grossSales',
    label: 'Gross Sales',
    render: 'bar',
    unit: 'usd',
    availability,
    points: daily.map((point) => ({ date: point.date, value: point.grossSales })),
    markers: [],
  };

  const netUnits: TimelineLayer = {
    id: 'netUnits',
    label: 'Net Units',
    render: 'bar',
    unit: 'units',
    availability,
    points: daily.map((point) => ({ date: point.date, value: point.netUnits })),
    markers: [],
  };

  const returnRate: TimelineLayer = {
    id: 'returnRate',
    label: 'Return Rate',
    render: 'line',
    unit: 'percent',
    availability,
    points: daily.map((point) => ({
      date: point.date,
      value: point.returnRate === null ? null : point.returnRate * 100,
    })),
    markers: [],
  };

  const price: TimelineLayer = {
    id: 'price',
    label: `Sale price (${PRICING_REFERENCE_MARKET_LABEL})`,
    render: 'line',
    unit: 'usd',
    availability,
    // buildPricingTimeline only ever populates a price from the US/USD reference market
    // (domain/pricing.ts), so a non-null salePrice is always USD minor units (cents).
    points: pricing.points.map((point) => ({
      date: point.date,
      value: point.salePrice === null ? null : point.salePrice / 100,
    })),
    markers: [],
  };

  const discount: TimelineLayer = {
    id: 'discount',
    label: `Observed effective discount (${PRICING_REFERENCE_MARKET_LABEL})`,
    render: 'line',
    unit: 'percent',
    availability,
    points: pricing.points.map((point) => ({ date: point.date, value: point.effectiveDiscountPercent })),
    markers: [],
  };

  const notConnected = NOT_CONNECTED_LAYER_DEFINITIONS.map(notConnectedLayer);

  const byId = new Map<TimelineLayerId, TimelineLayer>(
    [grossSales, netUnits, returnRate, price, discount, ...notConnected].map((layer) => [layer.id, layer]),
  );

  return {
    range,
    layers: TIMELINE_LAYER_ORDER.map((id) => {
      const layer = byId.get(id);
      if (!layer) throw new Error(`No builder produced timeline layer "${id}".`);
      return layer;
    }),
  };
}

/**
 * Parses a comma-separated `layers` search param into known layer ids.
 * Absent/blank falls back to the default set; the literal `none` (what the
 * legend links to when the last enabled layer is toggled off) means zero
 * layers, distinct from "param not set".
 */
export function parseEnabledTimelineLayers(raw: string | undefined): readonly TimelineLayerId[] {
  if (raw === undefined || raw.trim() === '') return DEFAULT_ENABLED_TIMELINE_LAYERS;
  if (raw === 'none') return [];
  const known = new Set(TIMELINE_LAYER_ORDER);
  const requested = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id): id is TimelineLayerId => known.has(id as TimelineLayerId));
  return requested;
}
