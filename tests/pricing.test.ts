import { describe, expect, it } from 'vitest';
import { DETECTED_DISCOUNT_LABEL, buildPricingTimeline } from '@/domain/pricing';
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
