import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENABLED_TIMELINE_LAYERS,
  TIMELINE_LAYER_ORDER,
  buildUnifiedTimeline,
  parseEnabledTimelineLayers,
  type TimelineLayerId,
} from '@/domain/timeline';
import type { DailySalesPoint, PricingTimeline } from '@/domain/types';

const RANGE = { start: '2025-05-01', end: '2025-05-03' } as const;

function dailyPoint(overrides: Partial<DailySalesPoint> = {}): DailySalesPoint {
  return {
    date: '2025-05-01',
    grossUnits: 0,
    returnedUnitsSigned: 0,
    returnedUnitsDisplay: 0,
    netUnits: 0,
    returnRate: null,
    grossSales: 0,
    grossReturns: 0,
    netTax: 0,
    netSteamSales: 0,
    revenueShare: 0,
    aggregation: 'fine-grain',
    ...overrides,
  };
}

const EMPTY_PRICING: PricingTimeline = { points: [], periods: [] };

describe('buildUnifiedTimeline', () => {
  it('returns every layer in the fixed order, once each', () => {
    const timeline = buildUnifiedTimeline({ range: RANGE, source: 'mock', daily: [], pricing: EMPTY_PRICING });
    expect(timeline.layers.map((layer) => layer.id)).toEqual(TIMELINE_LAYER_ORDER);
  });

  it('marks GGG sales, units and return rate as connected, carrying real repository values', () => {
    const daily = [
      dailyPoint({ date: '2025-05-01', grossSales: 100, netUnits: 5, returnRate: 0.1 }),
      dailyPoint({ date: '2025-05-02', grossSales: 200, netUnits: 8, returnRate: null }),
    ];
    const timeline = buildUnifiedTimeline({ range: RANGE, source: 'mock', daily, pricing: EMPTY_PRICING });

    const grossSales = timeline.layers.find((layer) => layer.id === 'grossSales')!;
    expect(grossSales.availability).toEqual({ status: 'connected', source: 'mock' });
    expect(grossSales.points).toEqual([
      { date: '2025-05-01', value: 100 },
      { date: '2025-05-02', value: 200 },
    ]);

    const netUnits = timeline.layers.find((layer) => layer.id === 'netUnits')!;
    expect(netUnits.points.map((point) => point.value)).toEqual([5, 8]);

    // Return Rate is converted from a fraction (0.1) to percentage points (10), and a
    // null return rate stays null rather than becoming zero (UI_SPEC.md: "No data, not zero").
    const returnRate = timeline.layers.find((layer) => layer.id === 'returnRate')!;
    expect(returnRate.points).toEqual([
      { date: '2025-05-01', value: 10 },
      { date: '2025-05-02', value: null },
    ]);
  });

  it('derives price (USD) and discount from the pricing timeline, reference-market only', () => {
    const pricing: PricingTimeline = {
      points: [
        {
          date: '2025-05-01',
          basePrice: 7999,
          salePrice: 2399,
          currency: 'USD',
          effectiveDiscountPercent: 70,
          totalDiscountPercentage: 70,
          bundleParticipation: false,
        },
        // No US/USD observation this day: buildPricingTimeline reports null rather than
        // borrowing another market's currency, and the timeline layer must not either.
        {
          date: '2025-05-02',
          basePrice: null,
          salePrice: null,
          currency: null,
          effectiveDiscountPercent: null,
          totalDiscountPercentage: null,
          bundleParticipation: false,
        },
      ],
      periods: [],
    };
    const timeline = buildUnifiedTimeline({ range: RANGE, source: 'bigquery', daily: [], pricing });

    const price = timeline.layers.find((layer) => layer.id === 'price')!;
    expect(price.points).toEqual([
      { date: '2025-05-01', value: 23.99 },
      { date: '2025-05-02', value: null },
    ]);
    expect(price.availability).toEqual({ status: 'connected', source: 'bigquery' });

    const discount = timeline.layers.find((layer) => layer.id === 'discount')!;
    expect(discount.points).toEqual([
      { date: '2025-05-01', value: 70 },
      { date: '2025-05-02', value: null },
    ]);
  });

  it('represents CCU, reviews and events as not_connected with empty points/markers, never fabricated', () => {
    const timeline = buildUnifiedTimeline({ range: RANGE, source: 'mock', daily: [], pricing: EMPTY_PRICING });

    for (const id of ['ccu', 'reviews', 'events'] as const) {
      const layer = timeline.layers.find((candidate) => candidate.id === id)!;
      expect(layer.availability.status).toBe('not_connected');
      expect(layer.points).toEqual([]);
      expect(layer.markers).toEqual([]);
      if (layer.availability.status === 'not_connected') {
        expect(layer.availability.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('never marks a not_connected layer as connected regardless of repository source', () => {
    const mockTimeline = buildUnifiedTimeline({ range: RANGE, source: 'mock', daily: [], pricing: EMPTY_PRICING });
    const bigQueryTimeline = buildUnifiedTimeline({ range: RANGE, source: 'bigquery', daily: [], pricing: EMPTY_PRICING });

    for (const timeline of [mockTimeline, bigQueryTimeline]) {
      const events = timeline.layers.find((layer) => layer.id === 'events')!;
      expect(events.availability.status).toBe('not_connected');
    }
  });
});

describe('parseEnabledTimelineLayers', () => {
  it('falls back to the default set when the param is absent or blank', () => {
    expect(parseEnabledTimelineLayers(undefined)).toEqual(DEFAULT_ENABLED_TIMELINE_LAYERS);
    expect(parseEnabledTimelineLayers('')).toEqual(DEFAULT_ENABLED_TIMELINE_LAYERS);
    expect(parseEnabledTimelineLayers('   ')).toEqual(DEFAULT_ENABLED_TIMELINE_LAYERS);
  });

  it('treats the literal "none" as zero layers, distinct from an unset param', () => {
    expect(parseEnabledTimelineLayers('none')).toEqual([]);
  });

  it('parses a comma-separated list of known layer ids, preserving requested order', () => {
    expect(parseEnabledTimelineLayers('discount,grossSales')).toEqual(['discount', 'grossSales']);
  });

  it('drops unknown ids rather than throwing or substituting a guess', () => {
    const result = parseEnabledTimelineLayers('grossSales,not-a-real-layer,ccu');
    expect(result).toEqual(['grossSales', 'ccu']);
  });

  it('every layer id it can return is a real timeline layer id', () => {
    const ids: readonly TimelineLayerId[] = parseEnabledTimelineLayers('grossSales,netUnits,returnRate,price,discount,ccu,reviews,events');
    expect(ids).toEqual(TIMELINE_LAYER_ORDER);
  });
});
