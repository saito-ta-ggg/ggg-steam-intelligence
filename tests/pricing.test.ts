import { describe, expect, it } from 'vitest';
import {
  DETECTED_DISCOUNT_LABEL,
  PRICING_REFERENCE_MARKET,
  PRICING_REFERENCE_MARKET_LABEL,
  buildPricingTimeline,
} from '@/domain/pricing';
import { row } from './factory';

describe('pricing timeline', () => {
  it('computes the observed effective discount per day', () => {
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-01', base_price: 8000, sale_price: 8000, gross_units_sold: 10 }),
      row({ date: '2025-05-02', base_price: 8000, sale_price: 2400, gross_units_sold: 40 }),
    ]);
    expect(timeline.points[0]?.effectiveDiscountPercent).toBe(0);
    expect(timeline.points[1]?.effectiveDiscountPercent).toBeCloseTo(70, 10);
  });

  it('prefers the observed discount over total_discount_percentage', () => {
    // A bundle adjustment the reported percentage misses.
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-02', base_price: 8000, sale_price: 4000, total_discount_percentage: 0, gross_units_sold: 5 }),
    ]);
    expect(timeline.points[0]?.effectiveDiscountPercent).toBe(50);
    expect(timeline.points[0]?.totalDiscountPercentage).toBe(0);
  });

  it('does not treat bundle participation alone as a discount', () => {
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-01', base_price: 8000, sale_price: 8000, bundleid: 42, gross_units_sold: 5 }),
    ]);
    expect(timeline.points[0]?.bundleParticipation).toBe(true);
    expect(timeline.periods).toHaveLength(0);
  });

  it('groups contiguous discounted days into one detected period', () => {
    const discounted = (date: string) =>
      row({ date, base_price: 8000, sale_price: 2400, gross_units_sold: 20, gross_units_returned: -1 });
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-01', base_price: 8000, sale_price: 8000, gross_units_sold: 5 }),
      discounted('2025-05-02'),
      discounted('2025-05-03'),
      discounted('2025-05-04'),
      row({ date: '2025-05-05', base_price: 8000, sale_price: 8000, gross_units_sold: 5 }),
    ]);
    expect(timeline.periods).toHaveLength(1);
    expect(timeline.periods[0]?.start).toBe('2025-05-02');
    expect(timeline.periods[0]?.end).toBe('2025-05-04');
    expect(timeline.periods[0]?.maxDiscountPercent).toBeCloseTo(70, 10);
    expect(timeline.periods[0]?.grossUnits).toBe(60);
    expect(timeline.periods[0]?.returnRate).toBeCloseTo(3 / 60, 10);
  });

  it('splits a period when the discounted days are not contiguous', () => {
    const discounted = (date: string) =>
      row({ date, base_price: 8000, sale_price: 4000, gross_units_sold: 10 });
    const timeline = buildPricingTimeline([discounted('2025-05-02'), discounted('2025-05-09')]);
    expect(timeline.periods).toHaveLength(2);
  });

  it('never invents an event name', () => {
    expect(DETECTED_DISCOUNT_LABEL).toBe('Detected discounted period');
  });
});

describe('pricing reference market — currencies are never mixed', () => {
  const us = (overrides = {}) => ({ country_code: 'US', currency: 'USD', ...overrides });
  const jp = (overrides = {}) => ({ country_code: 'JP', currency: 'JPY', ...overrides });

  it('is US / USD in Phase 1', () => {
    expect(PRICING_REFERENCE_MARKET).toEqual({ countryCode: 'US', currency: 'USD' });
    expect(PRICING_REFERENCE_MARKET_LABEL).toBe('US / USD');
  });

  it('takes the price from the reference market even when another market sells more', () => {
    // The original defect: the highest-volume observation won regardless of market,
    // so a JPY base price could be paired with a USD sale price.
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-02', ...jp({ base_price: 848000, sale_price: 848000 }), gross_units_sold: 5000 }),
      row({ date: '2025-05-02', ...us({ base_price: 7999, sale_price: 2399 }), gross_units_sold: 10 }),
    ]);
    expect(timeline.points[0]?.basePrice).toBe(7999);
    expect(timeline.points[0]?.salePrice).toBe(2399);
    expect(timeline.points[0]?.currency).toBe('USD');
    expect(timeline.points[0]?.effectiveDiscountPercent).toBeCloseTo((100 * (7999 - 2399)) / 7999, 10);
  });

  it('never reports a currency other than the reference currency', () => {
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-01', ...jp({ base_price: 848000, sale_price: 424000 }), gross_units_sold: 900 }),
      row({ date: '2025-05-01', ...us({ base_price: 7999, sale_price: 7999 }), gross_units_sold: 3 }),
      row({ date: '2025-05-02', ...jp({ base_price: 848000, sale_price: 424000 }), gross_units_sold: 900 }),
      row({ date: '2025-05-02', ...us({ base_price: 7999, sale_price: 7999 }), gross_units_sold: 3 }),
    ]);
    for (const point of timeline.points) {
      expect(point.currency === null || point.currency === 'USD').toBe(true);
    }
  });

  it('reports no discount from a non-reference market discount alone', () => {
    // JP is half price; US is not. The detected period must not fire.
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-01', ...jp({ base_price: 848000, sale_price: 424000 }), gross_units_sold: 900 }),
      row({ date: '2025-05-01', ...us({ base_price: 7999, sale_price: 7999 }), gross_units_sold: 3 }),
    ]);
    expect(timeline.points[0]?.effectiveDiscountPercent).toBe(0);
    expect(timeline.periods).toHaveLength(0);
  });

  it('reports No data rather than borrowing a currency when the reference market is absent', () => {
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-01', ...jp({ base_price: 848000, sale_price: 424000 }), gross_units_sold: 900 }),
    ]);
    expect(timeline.points[0]?.basePrice).toBeNull();
    expect(timeline.points[0]?.salePrice).toBeNull();
    expect(timeline.points[0]?.currency).toBeNull();
    expect(timeline.points[0]?.effectiveDiscountPercent).toBeNull();
    expect(timeline.periods).toHaveLength(0);
  });

  it('ignores a US row whose currency is not the reference currency', () => {
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-01', country_code: 'US', currency: 'CAD', base_price: 10499, sale_price: 5249, gross_units_sold: 500 }),
    ]);
    expect(timeline.points[0]?.basePrice).toBeNull();
  });

  it('keeps unit and money aggregates across every market, not just the reference one', () => {
    const timeline = buildPricingTimeline([
      row({ date: '2025-05-02', ...jp({ base_price: 848000, sale_price: 424000 }), gross_units_sold: 40, gross_sales_usd: 1000 }),
      row({ date: '2025-05-02', ...us({ base_price: 7999, sale_price: 2399 }), gross_units_sold: 10, gross_sales_usd: 240 }),
    ]);
    expect(timeline.periods).toHaveLength(1);
    // Worldwide units and USD sales for the period, though the price is US-only.
    expect(timeline.periods[0]?.grossUnits).toBe(50);
    expect(timeline.periods[0]?.grossSales).toBe(1240);
  });
});
