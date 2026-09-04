# Phase 2A — Visualization-First Timeline Foundation

## Goal
GGG Steam Intelligence is differentiated from a plain BigQuery dashboard by combining GGG-authoritative actuals
with Steam product/store context on one visual timeline (see product direction referenced in issue #4;
`docs/PRODUCT_VISION_AND_ROADMAP.md` from PR #3 was not reachable from this branch — see "What was not done"
below). Phase 2A adds the reusable contract and the first visual surface for that timeline, using only data this
repository can legitimately supply today. It does not add any new external data source.

## What was implemented

### 1. Unified timeline contract — `src/domain/timeline.ts`
A single `TimelineLayer` shape every layer of the combined timeline uses, whether connected or not:

```ts
type TimelineAvailability =
  | { status: 'connected'; source: 'mock' | 'bigquery' }
  | { status: 'not_connected'; reason: string };

interface TimelineLayer {
  id: TimelineLayerId; // 'grossSales' | 'netUnits' | 'returnRate' | 'price' | 'discount' | 'ccu' | 'reviews' | 'events'
  label: string;
  render: 'bar' | 'line' | 'marker';
  unit: 'usd' | 'units' | 'percent' | 'players' | 'score' | 'count';
  availability: TimelineAvailability;
  points: readonly { date: string; value: number | null }[];
  markers: readonly { date: string; label: string }[];
}
```

`buildUnifiedTimeline()` assembles this from `SalesRepository.getDailySales` + `getPricingTimeline` output (no new
SQL, no new repository method) plus a fixed, static list of not-yet-connected layer definitions. It performs no
I/O and contains no fabricated values: a layer this repository cannot supply is always `not_connected`, with
`points`/`markers` empty and a `reason` naming the missing table/API, regardless of whether the underlying
repository is `mock` or `bigquery`.

Connecting a future source (Review API, Store API, a CCU feed, a canonical events table) means adding one more
builder that returns this same shape with `availability.status === 'connected'`. The chart component and the page
that assembles the timeline do not need to change.

### 2. Visualization — new `Timeline` tab
- Path: `/apps/{appId}/timeline` (e.g. `/apps/1096900/timeline` for RPG Maker MZ; the route and every domain
  function are keyed off `appId`/`Scope`, not hard-coded to MZ — the same page works for RPG Maker MV,
  `/apps/363890/timeline`, or any future product added to `PRODUCT_CATALOG`).
- `src/components/UnifiedTimelineChart.tsx`: server-rendered SVG "swimlane" chart, one row per enabled layer,
  sharing one date axis. Consistent with the existing `TimeSeriesChart` (no charting library, no client
  JavaScript — every value is inspectable via `<title>`).
- `src/components/TimelineLegend.tsx`: legend + toggle links for every layer the contract defines, including the
  not-connected ones. Toggling on a not-connected layer shows its placeholder row, so the intended combined
  visualization (what plugs in, and where) is evaluable now. State lives in the URL (`?layers=...`), matching the
  rest of the app's shareable-link convention.

### 3. Layers that are real data today (source: mock in this environment; the same code path serves BigQuery once
that repository is connected — see `docs/DATA_MODEL.md`)
| Layer | Source | Notes |
|---|---|---|
| Gross Sales | `detailed_sales` via `getDailySales` | Fine-grain rule, `docs/METRICS.md` |
| Net Units | `detailed_sales` via `getDailySales` | Authoritative `net_units_sold` |
| Return Rate | `detailed_sales` via `getDailySales` | Converted to percentage points; `null` stays `null`, never `0` |
| Price (sale price) | `detailed_sales` via `getPricingTimeline` | US/USD reference market only, `docs/OPEN_QUESTIONS.md` #17 |
| Observed effective discount | `detailed_sales` via `getPricingTimeline` | Same reference-market rule |

### 4. Layers that are explicitly NOT connected (rendered as a labelled placeholder, never mocked as real)
| Layer | Why | Tracking |
|---|---|---|
| CCU (concurrent players) | No CCU table/feed exists in this repository | `docs/DATA_MODEL.md` provisional `steam_ccu_snapshot`; `docs/OPEN_QUESTIONS.md` #19 (new) |
| Reviews | Review API not connected | `docs/DATA_MODEL.md` provisional `steam_reviews`/`steam_review_daily_snapshot`; `docs/OPEN_QUESTIONS.md` #5 |
| Updates / promotions / events | No canonical event source | `docs/DATA_MODEL.md` provisional `steam_events`; `docs/OPEN_QUESTIONS.md` #4, #7 |

The existing "Detected discounted period" price-derived signal (already shipped in Phase 1's Overview/Pricing
tabs) remains the one event-like marker the warehouse can support; it is exposed here as the `discount` layer, not
as a fabricated `events` layer.

### 5. Existing exact-value surfaces are unchanged
Overview, Sales, Pricing & Sales, Countries, DLC, Reviews and Updates tabs, and their tables/KPI cards, are not
modified. The Timeline tab is an additional visual surface, not a replacement for exact-value detail.

## What was not done / limitations
- **PR #3 / `docs/PRODUCT_VISION_AND_ROADMAP.md` could not be inspected.** The Claude Code execution environment
  for this task had no network access to fetch other branches/PRs from the GitHub remote (only `main` and the
  working branch were available locally, and no `docs/PRODUCT_VISION_AND_ROADMAP.md` exists on either). This
  implementation therefore follows the issue body's own description of the product direction and the existing
  `docs/REQUIREMENTS.md`/`UI_SPEC.md`/`DATA_MODEL.md`/`METRICS.md` (CLAUDE.md: docs are the source of truth).
  Please reconcile against PR #3 once both are visible in the same environment.
- No Review API, Store API, CCU or canonical event data was added, fetched, or scraped — per the issue's explicit
  instruction not to fabricate these or silently scrape SteamDB/ITAD/steam-stats.
- The unified timeline is currently assembled per-page from existing `SalesRepository` methods; it does not add a
  new repository method. If a future layer needs a genuinely new repository call (e.g. `getCcuTimeline`), add it
  to `SalesRepository` following the pattern in `docs/DATA_MODEL.md` "Repository boundary" and feed its output
  into a new `buildUnifiedTimeline` parameter — the `TimelineLayer` contract does not need to change.
