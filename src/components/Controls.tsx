'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useId } from 'react';
import type { ProductDefinition } from '@/domain/scope';
import type { DateRange, ScopeKind } from '@/domain/types';
import { RANGE_PRESETS } from '@/lib/params';

/**
 * Global controls: product selector, date range and scope indicator.
 * Client-side only for navigation — no data access happens here.
 */
export function Controls({
  products,
  appId,
  range,
  bounds,
  scopeKind,
  activePreset,
}: {
  readonly products: readonly ProductDefinition[];
  readonly appId: number;
  readonly range: DateRange;
  readonly bounds: DateRange;
  readonly scopeKind: ScopeKind;
  readonly activePreset: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromId = useId();
  const toId = useId();

  const withParams = useCallback(
    (overrides: Record<string, string | null>, nextPathname = pathname) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(overrides)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      return query ? `${nextPathname}?${query}` : nextPathname;
    },
    [pathname, searchParams],
  );

  const onProductChange = (nextAppId: string) => {
    // Keep the current tab when switching products; the app is not MZ-specific.
    const tab = pathname.split('/').at(-1) ?? 'overview';
    router.push(withParams({}, `/apps/${nextAppId}/${tab}`));
  };

  return (
    <div className="controls">
      <div className="field">
        <label htmlFor="product-select">Product</label>
        <select
          id="product-select"
          value={String(appId)}
          onChange={(event) => onProductChange(event.target.value)}
        >
          {products.map((product) => (
            <option key={product.appId} value={String(product.appId)}>
              {product.name} ({product.appId})
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="scope-select">Scope</label>
        <select
          id="scope-select"
          value={scopeKind}
          onChange={(event) => router.push(withParams({ scope: event.target.value }))}
        >
          <option value="base">Base product only (DLC excluded)</option>
          <option value="app">All packages under AppID (base + DLC)</option>
          <option value="dlc">DLC / non-base packages only</option>
        </select>
      </div>

      <form
        className="field"
        style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const from = String(data.get('from') ?? '');
          const to = String(data.get('to') ?? '');
          if (!from || !to || from > to) return;
          router.push(withParams({ from, to, preset: null }));
        }}
      >
        <span className="field">
          <label htmlFor={fromId}>From</label>
          <input id={fromId} name="from" type="date" defaultValue={range.start} min={bounds.start} max={bounds.end} />
        </span>
        <span className="field">
          <label htmlFor={toId}>To</label>
          <input id={toId} name="to" type="date" defaultValue={range.end} min={bounds.start} max={bounds.end} />
        </span>
        <button className="button" type="submit">
          Apply
        </button>
      </form>

      <div className="field" style={{ flex: 1 }}>
        <label>Presets</label>
        <div className="presets">
          {RANGE_PRESETS.map((preset) => (
            <a
              key={preset.id}
              className="preset"
              aria-current={activePreset === preset.id ? 'page' : undefined}
              href={withParams({ preset: preset.id, from: null, to: null })}
            >
              {preset.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
