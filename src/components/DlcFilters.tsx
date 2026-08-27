'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId } from 'react';

/** Search, sort and minimum-units filters for the DLC table (UI_SPEC.md). */
export function DlcFilters({
  search,
  minUnits,
  sortKey,
  sortOptions,
  kind,
  kindOptions,
}: {
  readonly search: string;
  readonly minUnits: number;
  readonly sortKey: string;
  readonly sortOptions: ReadonlyArray<{ key: string; label: string }>;
  readonly kind: string;
  readonly kindOptions: ReadonlyArray<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchId = useId();
  const minUnitsId = useId();

  const push = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <form
      className="controls"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        push({ q: String(data.get('q') ?? ''), minUnits: String(data.get('minUnits') ?? '') });
      }}
    >
      <div className="field">
        <label htmlFor={searchId}>Search package</label>
        <input id={searchId} name="q" type="search" defaultValue={search} placeholder="Name or package ID" />
      </div>
      <div className="field">
        <label htmlFor={minUnitsId}>Minimum gross units</label>
        <input id={minUnitsId} name="minUnits" type="number" min={0} step={1} defaultValue={minUnits || ''} />
      </div>
      <button className="button" type="submit">
        Apply filters
      </button>
      <div className="field">
        <label htmlFor="kind-select">Package type</label>
        <select id="kind-select" value={kind} onChange={(event) => push({ kind: event.target.value })}>
          {kindOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="dlc-sort-select">Sort by</label>
        <select id="dlc-sort-select" value={sortKey} onChange={(event) => push({ sort: event.target.value })}>
          {sortOptions.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
