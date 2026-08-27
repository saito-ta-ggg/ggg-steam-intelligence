# GGG Steam Intelligence — Product Vision and Roadmap

## Product goal
Build a GGG-specialized Steam intelligence product that broadly covers the useful information and analytical capabilities found across SteamDB, IsThereAnyDeal, steam-stats.com, and other strong Steam intelligence services, then combines those public/official signals with GGG-authoritative internal sales data.

The goal is **not** merely a BigQuery sales dashboard and is **not** to clone any single external site.

The core differentiator is a unified product/event/performance timeline where GGG can relate Steam product/store changes, pricing and promotions, player/review signals, and GGG actual commercial results.

## Product principle: visualization first
The product succeeds when users can **see relationships and changes**, not merely retrieve rows or metrics.

Primary UX should make it easy to visually answer questions such as:
- What happened to sales before, during and after a discount?
- Did CCU, reviews and sales move together around an update?
- Which countries reacted most strongly to a promotion?
- Did return rate change around a release, update, package change or sale?
- Which DLC accelerated or declined during the same period?

Where metrics share a useful time axis, prefer coordinated charts and event overlays over isolated tables. Tables remain available for exact values and export, but visualization is the primary analytical surface.

## Design principles
1. **Visualization-first.** Design data collection and APIs around the visual questions the product must answer.
2. **Phased ingestion.** Do not block the product on data sources that are not currently obtainable. Ship useful visualizations with available sources, then add new layers as Review API, Store API or other sources become available.
3. Prefer official Steam/public APIs and GGG-owned data over scraping when possible.
4. Do not fabricate unavailable values or present estimates as actuals.
5. Keep external/public signals and GGG-authoritative financial data provenance-visible.
6. Build reusable app/package/DLC models rather than hard-coding RPG Maker MZ.
7. Preserve historical observations so changes can be analyzed over time.
8. Treat external sites as feature-discovery references, not data sources unless their terms and technical interfaces explicitly permit reuse.
9. Every metric should have a documented source, grain, refresh cadence, and confidence/authority level.
10. A missing source must degrade explicitly: `available`, `not connected`, `not currently obtainable`, or `no observation for period`. Never silently substitute another source.

## Capability map

### A. Product / Steam metadata
- App identity, type, release date, developer, publisher
- Store description and media references
- Categories, genres, tags, supported languages
- Platforms / OS support
- Steam Deck / compatibility signals where obtainable
- Controller/features/achievements/trading-card metadata
- App/package/bundle relationships
- DLC catalogue and relationships
- Depots/branches/build IDs and change history where officially/publicly obtainable

### B. Price / promotion intelligence
- Current Steam price by market/currency
- Historical observed Steam prices
- Discount percentage and discounted periods
- Historical lows and price-change events
- Package/bundle pricing relationships
- Promotion/event timeline
- Regional price comparisons
- External authorized-store prices and deal history where a lawful/licensed source is available
- Bundle participation/history where a lawful/licensed source is available

### C. Player / engagement intelligence
- Current concurrent players
- Daily/period peak concurrent players
- Historical CCU timeline
- Player-count trend and peak records
- Playtime/ownership estimates only when clearly labelled as third-party estimates and legally/technically sourced

### D. Reviews / reception
- Current positive/negative review counts and score
- Recent vs lifetime review trend
- Review-count velocity
- Review-score changes over time
- Language/country breakdown where source data supports it
- Review event overlays on the unified timeline

If review data is not yet obtainable through the chosen API/source, the Review surface remains visibly `not connected` rather than blocking other timeline layers.

### E. Updates / product activity
- Steam news/update posts
- Build/update history
- Branch/depot change observations where available
- Release/update/event markers
- Change detection for important store metadata

### F. GGG-authoritative commercial performance
- Gross Sales
- Net Steam Sales
- Revenue Share / internal NET with documented exclusions
- Gross / Returned / Net Units
- Return Rate
- Country/region/platform performance
- Base product vs DLC vs bundle/package performance
- Retail/CD-key activations kept separate from Steam Store revenue
- Fiscal/calendar reporting
- DLC contribution and attach-style analyses where definitions are approved

### G. Integrated GGG analysis — key differentiation
- Sales vs price/discount timeline
- Sales vs CCU timeline
- Sales vs review trend
- Sales vs update/build events
- Sales vs promotion/event periods
- Return-rate anomalies around releases, discounts, updates, countries, packages and DLC
- DLC contribution and portfolio comparison
- Country response to promotions and pricing
- Before/during/after event comparisons
- Comparable-period and YoY analysis
- Automated anomaly/change flags without unsupported causal claims

### H. Portfolio / comparison views
- Search/select any registered GGG Steam title
- Cross-title KPI comparison
- MZ/MV and related DLC comparisons
- Portfolio sale/event calendar
- Product health/watchlist view
- Optional public competitor mode, clearly separated from GGG actuals

## Visualization architecture
The central visual object is a **unified time axis**. Each available source contributes one or more layers:

- GGG actual sales / units / return rate
- price and discount
- promotion / sale periods
- CCU / player activity
- review count / score
- update / build / news events
- package / DLC events
- manually curated GGG events when no canonical machine-readable source exists

Users must be able to toggle layers without changing the underlying period, scope or product. Event markers should be clickable and expose provenance. Numerical layers should support exact-value tables beneath or beside charts.

The implementation must allow a layer to be absent without breaking the timeline. A source can be added later without redesigning the whole page.

## Source strategy

### Tier 1 — authoritative
- GGG BigQuery / Steamworks-derived financial data
- Official Steam store/app endpoints and other officially permitted Steam sources
- GGG-maintained product/event metadata

### Tier 2 — public observations
- Periodic snapshots of publicly visible Steam state collected by GGG
- Public concurrent-player observations
- Public review/store metadata observations

### Tier 3 — licensed/approved third-party data
- Authorized-store/deal/bundle datasets when terms/API access permit
- Third-party estimates only when provenance and estimate status are explicit

Do not make SteamDB, IsThereAnyDeal, steam-stats.com or similar sites runtime dependencies merely because they are feature references.

## Data availability states
Every planned source/capability should have one of these explicit states:

- **Available now** — source and acquisition path confirmed; implementation may proceed.
- **Available, not connected** — source exists but ingestion/integration has not been built.
- **Investigating** — technical or licensing/API feasibility is unresolved.
- **Not currently obtainable** — known desired data, but no approved acquisition path exists now.

Roadmap phases are based on these states, not on pretending all target data is available at once.

## Delivery roadmap

### Phase 1 — foundation (completed / mock)
Reusable product-detail UI and financial domain model with mock fixtures.

### Phase 2A — GGG actuals + financial visualization
Connect the existing repository boundary to BigQuery read-only data, reconcile MZ against authoritative monthly figures, preserve all metric/scope tests, and replace mock financial charts/tables with GGG actuals.

Deliver useful production-like visualization immediately from the data already controlled by GGG:
- sales and units trends
- return-rate trends
- country and DLC comparisons
- discount/sales overlays where price data is already available

### Phase 2B — available public Steam observations
Implement only sources whose acquisition path is currently confirmed. Create source adapters and historical snapshot storage with source and `observed_at` provenance.

Candidate layers include, where confirmed obtainable:
- public player counts / CCU
- product/package/DLC metadata
- pricing/discount observations
- public news/update markers

Review API, Store API and other desired sources are **not prerequisites** if their acquisition path is not yet confirmed.

### Phase 2C — unified visual timeline
Create the reusable visualization layer that combines all data available from 2A/2B on one time axis. The timeline must work with partial source coverage and show unavailable layers as such.

Acceptance target: for RPG Maker MZ, a user can select a period and visually compare the available combinations of sales, units, returns, discounts, CCU and events without navigating across disconnected reports.

### Phase 2D — source expansion
As acquisition paths are confirmed, add Review API / Store API / richer package/build/store metadata and other sources as new observation adapters and timeline layers. Adding these must not require redesigning the core visualization architecture.

### Phase 3 — deeper intelligence
Regional pricing, historical lows, richer package/depot/build history, authorized external-store/deal/bundle data, portfolio comparison, anomaly detection and event-impact analysis.

### Phase 4 — operational product
Production SSO/RBAC, scheduled ingestion, freshness/SLA monitoring, data-quality alerts, Cloud Run deployment, portfolio watchlists and recurring management/marketing views.

## Immediate implementation gate
Before adding many source-specific screens, define a reusable `SourceObservation` / provenance model and a unified timeline contract. Public-source history must be retained rather than fetched only at page-view time because historical change analysis is core product value.

Phase 2A can begin immediately. Phase 2B proceeds source-by-source as acquisition feasibility is confirmed. Phase 2C should begin as soon as at least two useful time-series/event layers can be displayed together; it does not wait for every desired API.

BigQuery integration must not become the architecture of the whole product; it is one authoritative source among several.

## Current business decisions still to resolve
- Arbitrary-range monetary aggregation
- Fiscal-year monetary aggregation
- Country-level Revenue Share reconciliation/label
- Community Market Game Fee sourcing/label
- Comparable-period convention
- US/USD reference-market choice and future per-market pricing

These should not block source-ingestion architecture, but production financial labels must not imply more precision or completeness than the approved definitions support.
