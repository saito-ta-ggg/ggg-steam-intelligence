# GGG Steam Intelligence — Product Vision and Roadmap

## Product goal
Build a GGG-specialized Steam intelligence product that broadly covers the useful information and analytical capabilities found across SteamDB, IsThereAnyDeal, steam-stats.com, and other strong Steam intelligence services, then combines those public/official signals with GGG-authoritative internal sales data.

The goal is **not** merely a BigQuery sales dashboard and is **not** to clone any single external site.

The core differentiator is a unified product/event/performance timeline where GGG can relate Steam product/store changes, pricing and promotions, player/review signals, and GGG actual commercial results.

## Design principles
1. Prefer official Steam/public APIs and GGG-owned data over scraping when possible.
2. Do not fabricate unavailable values or present estimates as actuals.
3. Keep external/public signals and GGG-authoritative financial data provenance-visible.
4. Build reusable app/package/DLC models rather than hard-coding RPG Maker MZ.
5. Preserve historical observations so changes can be analyzed over time.
6. Treat external sites as feature-discovery references, not data sources unless their terms and technical interfaces explicitly permit reuse.
7. Every metric should have a documented source, grain, refresh cadence, and confidence/authority level.

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

## Delivery roadmap

### Phase 1 — foundation (completed / mock)
Reusable product-detail UI and financial domain model with mock fixtures.

### Phase 2A — GGG actuals
Connect the existing repository boundary to BigQuery read-only data, reconcile MZ against authoritative monthly figures, preserve all metric/scope tests, and resolve or visibly label accounting open questions.

### Phase 2B — official/public Steam ingestion foundation
Create source adapters and historical snapshot storage for product metadata, current prices, reviews, player counts, news/updates and package/DLC relationships. Every observation stores source and observed-at time.

### Phase 2C — unified timeline
Merge GGG sales, price/discount, player/review, update/build and promotion/event signals into a single timeline with filters and provenance.

### Phase 3 — deeper intelligence
Regional pricing, historical lows, richer package/depot/build history, authorized external-store/deal/bundle data, portfolio comparison, anomaly detection and event-impact analysis.

### Phase 4 — operational product
Production SSO/RBAC, scheduled ingestion, freshness/SLA monitoring, data-quality alerts, Cloud Run deployment, portfolio watchlists and recurring management/marketing views.

## Immediate implementation gate
Before adding large amounts of UI, define a `SourceObservation`/provenance model and ingestion contracts so public-source history is retained rather than fetched only at page-view time. The product's value depends on historical change analysis.

Phase 2A and Phase 2B can proceed in parallel as separate adapters/storage concerns. BigQuery integration must not become the architecture of the whole product; it is one authoritative source among several.

## Current business decisions still to resolve
- Arbitrary-range monetary aggregation
- Fiscal-year monetary aggregation
- Country-level Revenue Share reconciliation/label
- Community Market Game Fee sourcing/label
- Comparable-period convention
- US/USD reference-market choice and future per-market pricing

These should not block source-ingestion architecture, but production financial labels must not imply more precision or completeness than the approved definitions support.
