'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useId } from 'react';

/** Search / region / sort controls for the Countries table (UI_SPEC.md). */
export function CountryFilters({
  regions,
  activeRegion,
  search,
  minUnits,
  sortKey,
  sortOptions,
}: {
  readonly regions: readonly string[];
  readonly activeRegion: string;
  readonly search: string;
  readonly minUnits: number;
  readonly sortKey: string;
  readonly sortOptions: ReadonlyArray<{ key: string; label: string }>;
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
        push({
          q: String(data.get('q') ?? ''),
          minUnits: String(data.get('minUnits') ?? ''),
        });
      }}
    >
      <div className="field">
        <label htmlFor={searchId}>Search country</label>
        <input id={searchId} name="q" type="search" defaultValue={search} placeholder="Name or code" />
      </div>
      <div className="field">
        <label htmlFor={minUnitsId}>Minimum gross units</label>
        <input id={minUnitsId} name="minUnits" type="number" min={0} step={1} defaultValue={minUnits || ''} />
      </div>
      <button className="button" type="submit">
        Apply filters
      </button>
      <div className="field">
        <label htmlFor="region-select">Region</label>
        <select id="region-select" value={activeRegion} onChange={(event) => push({ region: event.target.value })}>
          <option value="all">All regions</option>
          {regions.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="sort-select">Sort by</label>
        <select id="sort-select" value={sortKey} onChange={(event) => push({ sort: event.target.value })}>
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
