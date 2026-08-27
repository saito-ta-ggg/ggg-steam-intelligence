/**
 * URL search-param handling for the global date range and scope controls.
 * UI_SPEC.md requires the active range and scope to always be visible; keeping
 * them in the URL also makes every view linkable and shareable internally.
 */
import { addDays, clampRange } from '@/domain/dates';
import { fiscalYearBounds, fiscalYearOf } from '@/domain/fiscal';
import type { DateRange, ScopeKind } from '@/domain/types';

export type SearchParams = Record<string, string | string[] | undefined>;

export type Grain = 'daily' | 'monthly' | 'fiscal';
export type OverviewMetric = 'grossSales' | 'revenueShare' | 'netSteamSales' | 'netUnits' | 'grossUnits';

export const OVERVIEW_METRICS: ReadonlyArray<{ key: OverviewMetric; label: string; kind: 'money' | 'units' }> = [
  { key: 'grossSales', label: 'Gross Sales', kind: 'money' },
  { key: 'revenueShare', label: 'Revenue Share', kind: 'money' },
  { key: 'netSteamSales', label: 'Net Steam Sales', kind: 'money' },
  { key: 'netUnits', label: 'Net Units', kind: 'units' },
  { key: 'grossUnits', label: 'Gross Units', kind: 'units' },
];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface ResolvedParams {
  readonly range: DateRange;
  readonly scopeKind: ScopeKind;
  readonly grain: Grain;
  readonly metric: OverviewMetric;
  readonly showDiscountOverlay: boolean;
  readonly search: string;
  readonly minUnits: number;
  readonly region: string;
  readonly preset: string | null;
}

export interface RangePreset {
  readonly id: string;
  readonly label: string;
  resolve(bounds: DateRange): DateRange;
}

/** Presets are resolved against the warehouse bounds, never against the host clock. */
export const RANGE_PRESETS: readonly RangePreset[] = [
  { id: '30d', label: 'Last 30 days', resolve: (bounds) => ({ start: addDays(bounds.end, -29), end: bounds.end }) },
  { id: '90d', label: 'Last 90 days', resolve: (bounds) => ({ start: addDays(bounds.end, -89), end: bounds.end }) },
  { id: '365d', label: 'Last 365 days', resolve: (bounds) => ({ start: addDays(bounds.end, -364), end: bounds.end }) },
  {
    id: 'fy-current',
    label: 'Current FY',
    resolve: (bounds) => clampRange(fiscalYearBounds(fiscalYearOf(bounds.end)), bounds),
  },
  {
    id: 'fy-previous',
    label: 'Previous FY',
    resolve: (bounds) => clampRange(fiscalYearBounds(fiscalYearOf(bounds.end) - 1), bounds),
  },
  { id: 'all', label: 'All available', resolve: (bounds) => bounds },
];

export const DEFAULT_PRESET_ID = '90d';

function isScopeKind(value: string | undefined): value is ScopeKind {
  return value === 'base' || value === 'app' || value === 'dlc';
}

export function resolveParams(searchParams: SearchParams, bounds: DateRange): ResolvedParams {
  const from = first(searchParams.from);
  const to = first(searchParams.to);
  const presetId = first(searchParams.preset);

  let range: DateRange;
  let preset: string | null = null;

  if (from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to) {
    range = clampRange({ start: from, end: to }, bounds);
  } else {
    const chosen =
      RANGE_PRESETS.find((item) => item.id === presetId) ??
      RANGE_PRESETS.find((item) => item.id === DEFAULT_PRESET_ID);
    preset = chosen?.id ?? DEFAULT_PRESET_ID;
    range = chosen ? chosen.resolve(bounds) : bounds;
  }

  const grainParam = first(searchParams.grain);
  const metricParam = first(searchParams.metric);
  const scopeParam = first(searchParams.scope);
  const minUnits = Number(first(searchParams.minUnits) ?? '0');

  return {
    range,
    scopeKind: isScopeKind(scopeParam) ? scopeParam : 'base',
    grain: grainParam === 'monthly' || grainParam === 'fiscal' ? grainParam : 'daily',
    metric:
      OVERVIEW_METRICS.some((item) => item.key === metricParam)
        ? (metricParam as OverviewMetric)
        : 'grossSales',
    showDiscountOverlay: first(searchParams.overlay) !== 'off',
    search: (first(searchParams.q) ?? '').trim(),
    minUnits: Number.isFinite(minUnits) && minUnits > 0 ? Math.floor(minUnits) : 0,
    region: first(searchParams.region) ?? 'all',
    preset,
  };
}

/** Build a link that keeps the current controls and overrides only what changed. */
export function buildHref(
  pathname: string,
  current: SearchParams,
  overrides: Record<string, string | number | null>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const single = first(value);
    if (single !== undefined && single !== '') params.set(key, single);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) params.delete(key);
    else params.set(key, String(value));
  }
  // An explicit preset and an explicit from/to are mutually exclusive.
  if (overrides.preset !== undefined && overrides.preset !== null) {
    params.delete('from');
    params.delete('to');
  }
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
