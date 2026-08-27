# Phase 1 Review Package — GGG Steam Intelligence

Prepared for an independent technical review (ChatGPT) before Phase 2
(BigQuery production data integration) begins. This document is a snapshot
for review purposes only; it does not change any application code. Where
this document and `/docs` disagree, `/docs` is authoritative — the source
files are `docs/REQUIREMENTS.md`, `docs/METRICS.md`, `docs/DATA_MODEL.md`,
`docs/UI_SPEC.md`, and `docs/OPEN_QUESTIONS.md`.

Generated: 2026-08-27. Repository state: `main` at Phase 1 completion
(commit `0e6faac` and prior). Verified at generation time: `npm run verify`
(lint + typecheck + tests) passes — 11 test files, 169 tests, 0 failures.

---

## 1. Current architecture and directory structure

Stack: Next.js 15 (App Router) + React 19 + TypeScript, deployed to Google
Cloud Run as a standalone server bundle. BigQuery is server-side,
read-only, and not yet connected (Phase 2).

```
src/domain/     Pure logic: metric formulas, product scope, fiscal year,
                dates, country display, pricing/discount detection,
                formatting. No SQL, no React, no I/O. This is what the
                test suite targets most directly.
src/data/       Repository boundary.
                  repository.ts        the SalesRepository interface
                  index.ts             server-only accessor, selects mock
                                        vs. bigquery by DATA_SOURCE
                  mock/fixtures.ts     deterministic synthetic dataset
                  mock/mockRepository.ts implementation over the fixtures
                  bigquery/sql.ts      parameterised SQL builders (Phase 2,
                                        not executed yet)
                  bigquery/bigqueryRepository.ts  throws until Phase 2
src/app/        App Router pages (Server Components). Fetch data only
                through the repository (`getRepository()`), never
                directly.
                  apps/[appId]/overview, sales, pricing, countries, dlc,
                  dlc/[packageId], reviews, updates
src/components/ Presentation only. No SQL, no repository calls.
src/lib/        pageContext.ts (server-only: resolves product/scope/date
                range/repository for a page) and params.ts (URL search
                param parsing/building — pure, no I/O).
tests/          Vitest suite: metric formulas, scope rules, SQL builder
                shape, and architecture guards (see §11).
docs/           Source-of-truth requirements/metrics/data-model/UI spec/
                open questions.
```

Key boundary: `src/data/index.ts` and `src/lib/pageContext.ts` both start
with `import 'server-only'`, which makes it a build error for any client
component to import them — this is how BigQuery credentials and raw query
access are kept out of the browser bundle. Enforced by
`tests/architecture.test.ts`, not just by convention.

## 2. What was implemented in Phase 1

Per `README.md` / `docs/REQUIREMENTS.md`, against **mock fixtures only**
(`DATA_SOURCE=mock`, the default):

| Tab | State |
|---|---|
| Overview | KPI cards (Gross Sales, Revenue Share, Net Units, Return Rate), daily timeline, top countries, top DLC, detected discounted periods |
| Sales | Daily / calendar-month / fiscal-year grains, full metric table (Gross, Returns, Tax, Net Steam Sales, Revenue Share, Gross/Returned/Net Units, Return Rate) |
| Pricing & Sales | Observed effective discount, detected discounted periods, daily price observations, bundle-participation indicator |
| Countries | Ranking, search/region/sort/minimum-units filters, sales share, mandated Steam China label |
| DLC | Package list with type labels (base/DLC/bundle), filters, per-package detail page |
| Reviews | `data not yet connected` placeholder — no fabricated values |
| Updates | `data not yet connected` placeholder — no fabricated values |

Retail/CD-key activations are a separate, explicitly labelled panel at the
bottom of the Sales tab (`RetailActivationsPanel.tsx`): unit counts only,
no monetary column, so there is no figure there that could be summed into
Store revenue by accident.

Two products are registered in the catalogue (`src/domain/scope.ts`) so
the UI is demonstrably not hard-coded to one title: RPG Maker MZ (AppID
`1096900`, the validation title) and RPG Maker MV (AppID `363890`).

Out of scope for Phase 1 (per `docs/REQUIREMENTS.md`): competitor revenue
estimation, SteamDB/ITAD scraping, BigQuery writes, user-level ownership,
causal claims, production SSO.

## 3. Data model and important domain definitions

Warehouse table (Phase 2 target): `` `ggg-dashboard-494707.sales_steam.detailed_sales` ``,
location `asia-northeast1`, partitioned on `date` (partition filter
required on every query). Upstream source: Steamworks
`IPartnerFinancialsService.GetDetailedSales`.

Phase 1 fields mirrored 1:1 in `src/domain/types.ts` (`DetailedSalesRow`):

- **Identity**: `date, primary_appid, app_name, packageid, package_name, bundleid, bundle_name, line_item_type, package_sale_type`
- **Geography/platform**: `country_code, country_name, region, platform`
- **Sales**: `gross_units_sold, gross_units_returned, net_units_sold, gross_sales_usd, gross_returns_usd, net_tax_usd, net_sales_usd, revenue_share_usd, additional_revenue_share_tier`
- **Price**: `base_price, sale_price, currency, total_discount_percentage, combined_discount_id`
- **Retail**: `gross_units_activated, key_request_id, territory_code_description`

Key semantics:

- Returns (`gross_units_returned`, `gross_returns_usd`) are **signed
  negative**, as stored. `Math.abs()` is banned repo-wide except in
  `src/domain/numeric.ts` (an ESLint rule enforces this — see §12).
- `net_units_sold` and `net_sales_usd` are **authoritative stored
  values**, never re-derived as gross + returned.
- `revenue_share_usd` is warehouse-derived and is **not** summable
  row-by-row for the calendar-month Revenue Share figure (see §4).
- `XC` / country name `"Unknown Country"` = Steam China.
- `base_price` / `sale_price` are **local-currency minor units** (e.g.
  JPY, not USD), which is why they cannot be summed across countries
  without a currency conversion (see the pricing section of §4).
- Steam Store sales (`line_item_type='Package' AND package_sale_type='Steam'`)
  and Retail/CD-key activations (`package_sale_type='Retail'`) are always
  queried and displayed separately. Retail activation is **not** Store
  revenue.

Repository boundary (`docs/DATA_MODEL.md`, implemented as
`SalesRepository` in `src/data/repository.ts`):

```ts
getAppOverview(scope, dateRange)
getDailySales(scope, dateRange)          // fine-grain rule
getMonthlySales(scope, dateRange)        // calendar-month rule
getFiscalYearSales(scope, dateRange)     // sum of calendar-month results
getRangeTotals(scope, dateRange)         // fine-grain rule
getCountryPerformance(scope, dateRange)  // fine-grain rule
getDlcPerformance(primaryAppId, dateRange)
getPackagePerformance(primaryAppId, dateRange)  // base+DLC+bundle, labelled
getRetailActivations(scope, dateRange)
getPricingTimeline(scope, dateRange)
getFreshness()
```

React components contain no SQL and never see the repository directly —
`src/lib/pageContext.ts` resolves it per request.

### Product scope

A parent `primary_appid` is **not** automatically the base product.
`src/domain/scope.ts` encodes an explicit `PRODUCT_CATALOG`:

- RPG Maker MZ (`1096900`): base Package family `481511, 369820, 488238`;
  current base package `488238`.
- RPG Maker MV (`363890`): base Package family `65464, 80322`; package
  `88038` is the "MV Bundle" and is excluded from the base product.

`requireProduct()` **throws** for an unregistered AppID rather than
falling back to `primary_appid` alone — there is no silent path to an
under- or over-counted base-product total. Scope has three kinds:

- `base`: base product only (DLC excluded) — resolved through the Package
  family.
- `app`: everything under the AppID, base + DLC + bundles.
- `dlc`: non-base, non-bundle packages under the AppID.

`classifyPackage()` labels any package not declared base or bundle as
`dlc` by default — i.e., DLC classification is the fallback, not an
allowlist. This is a deliberate design choice worth the reviewer's
attention (see §13): a newly released DLC package needs no catalogue
update to be classified correctly, but it also means a data-entry error
that assigns an unexpected `packageid` to a known AppID would silently
be counted as DLC rather than rejected.

## 4. Definitions and formulas

All formulas below are transcribed verbatim from `docs/METRICS.md` into
`src/domain/metrics.ts`; the doc comments in that file cite the exact
`METRICS.md` section for each. No formula exists in code that is not
written in `METRICS.md`.

### Gross Sales
`SUM(gross_sales_usd)` — fine-grain rule (day, country, region, platform,
partial month: raw sum, rounded only for display). See "Calendar-month"
below for the month-grain rule, which is different.

### Gross Units / Net Units / Return Rate
- Gross Units = `SUM(gross_units_sold)`
- Returned Units, signed = `SUM(gross_units_returned)` (negative, as stored)
- Returned Units, display = `-SUM(gross_units_returned)` (sign flip, not `ABS()`)
- **Net Units = `SUM(net_units_sold)`** — the authoritative stored value,
  never derived as gross + returned
- **Return Rate = `-SUM(gross_units_returned) / SUM(gross_units_sold)`**
  — units-based only; returns `null` (rendered "No data") when gross
  units is 0, via `safeDivide`

### Revenue Share (internal NET)
**Not** a blanket `Net * 70%`. Two components, both scoped to a single
calendar month (`docs/METRICS.md`, "Revenue Share — calendar month"):

- **Basic component**, per month × `packageid`:
  ```text
  package_month_net = SUM(net_sales_usd)
  monthly_basic_70  = SUM(TRUNC(ROUND(package_month_net, 3) * 0.70, 2))
  ```
- **Additional component** (tiered), four steps:
  1. aggregate `net_sales_usd` by month × `packageid` × `primary_appid` × `additional_revenue_share_tier`
  2. truncate that package-level Net to cents
  3. re-aggregate by month × `primary_appid` × tier
  4. apply 5% (tier 1) or 10% (tier 2) and `ROUND` to cents
- `monthly_revenue_share = monthly_basic_70 + monthly_additional`
- Row-level `revenue_share_usd` is warehouse-derived and must **not** be
  summed directly for this figure — it is used only where the grain is
  explicitly fine-grain (e.g. the Countries tab; see the country-handling
  note below and Open Question #15).
- **Community Market Game Fee is absent from the warehouse** and is
  therefore absent from Revenue Share — never fabricated (Open Question
  #16). This makes Revenue Share incomplete for titles with Market
  activity; the gap is documented, not silently absorbed.

Implementation: `computeMonthlyBasicRevenueShare`,
`computeMonthlyAdditionalRevenueShare`, `computeCalendarMonthRevenueShare`
in `src/domain/metrics.ts:154-216`.

### Discounts (effective discount)
When `base_price > 0`:
```text
100 * (base_price - sale_price) / base_price
```
`null` when `base_price` is null, zero, or negative. This is **preferred
over `total_discount_percentage` alone**, because bundle adjustments may
otherwise be missed. `bundleid IS NOT NULL` alone does **not** prove a
discount — it is recorded only as a `bundleParticipation` indicator,
separate from the discount calculation
(`src/domain/pricing.ts:32-115`).

Because there is no canonical sale/event dataset yet (Open Question #4),
discounted stretches are **detected** from observed prices and labelled
`Detected discounted period` — no event name is ever invented. A
contiguous run of days with an observed discount above a small epsilon
(0.5 percentage points, to absorb rounding noise) forms one period; a gap
in the data ends the run (`detectDiscountPeriods`,
`src/domain/pricing.ts:117-196`).

### DLC / base-product aggregation
- DLC totals (`getDlcPerformance`) explicitly exclude both the base
  Package family and any bundle packages, so a base product can never
  appear in a DLC list or be counted as DLC revenue.
- `getPackagePerformance` returns every package under an AppID (base +
  DLC + bundle), each labelled with its `PackageKind`. It is deliberately
  named differently from "DLC" so a caller cannot mistake the result for
  a DLC-only list.
- Base-scope totals are always strictly ≤ app-scope totals for the same
  range (asserted in `tests/mockRepository.test.ts`).

### Country handling, including Steam China / XC
- Country performance (`getCountryPerformance`) uses the **fine-grain
  rule** (raw sum of `revenue_share_usd`, `gross_sales_usd`, etc. per
  country) — country is explicitly listed as a fine-grain dimension in
  `METRICS.md`.
- `XC` / country name `"Unknown Country"` is Steam China
  (`src/domain/country.ts`). Per `REQUIREMENTS.md`, it always renders as
  `Steam China (Country Code: XC)`, regardless of which of the two
  signals (code or name) is present.
- Other countries render as `Name (Code)`, falling back to just the code
  if no name is present.
- **Known reconciliation gap** (Open Question #15): because Countries is
  fine-grain and Sales/Overview Revenue Share (at month grain) is the
  calendar-month rule, summing the Countries tab's Revenue Share across
  all countries for a month will **not** exactly reconcile with the
  Sales tab's Revenue Share for that month. This is a consequence of
  applying `METRICS.md` literally per grain, not a bug, but it is a
  likely point of business confusion and is flagged for the reviewer.
- Sales share per country = country Gross Sales / scope-total Gross
  Sales for the range; `null` (not zero, not divide-by-zero) when the
  total is 0.

## 5. Date/time and fiscal-year handling

- The warehouse `date` column is the **Steam financial calculation date
  in Pacific Time**. It is treated as an opaque `YYYY-MM-DD` calendar
  date string throughout the app (`src/domain/dates.ts`) and is **never**
  converted to JST or run through the host machine's timezone. All date
  arithmetic (`addDays`, `eachDate`, month bounds) is done via UTC day
  numbers precisely so the host timezone cannot leak in.
- Fiscal year starts **April 1**. FY2025 = 2025-04-01 .. 2026-03-31
  (`src/domain/fiscal.ts`, `fiscalYearOf`/`fiscalYearBounds`).
- **FY monetary aggregation is a documented open assumption** (Open
  Question #11): `METRICS.md` defines a TRUNC intermediate grain for the
  calendar month but not for the fiscal year. Phase 1 sums the already-
  computed calendar-month results (`sumSalesMetrics`) rather than
  recomputing a month × package × FY intermediate grain. The UI labels FY
  rows with the `calendar-month` aggregation tag so the method is never
  implicit, but **this could produce different cents than a true FY-level
  TRUNC grain** if GGG's finance team expects one. This is the single
  highest-value formula question for the reviewer to flag back to the
  business (see §10 and §13).
- Range totals for an arbitrary multi-day range (e.g. "last 90 days")
  use the **fine-grain rule**, not a composition of calendar-month
  results, per the literal reading of `METRICS.md` (Open Question #10).
  Every surface states which rule (`fine-grain` vs `calendar-month`)
  produced its figures via the `aggregation` field on `MoneyMetrics`.
- Comparable-period delta (Overview KPI cards) uses "the immediately
  preceding range of equal length, ending the day before the selected
  range begins" (`previousRange` in `src/domain/dates.ts`). `METRICS.md`
  does not define this; it is a Phase 1 choice pending confirmation
  (Open Question #12) — not year-on-year, not previous-calendar-month.
- USD and Return Rate display to 2 decimals by default
  (`src/domain/format.ts`).

## 6. Mock data structure and how it differs from the future BigQuery source

`src/data/mock/fixtures.ts` generates a deterministic synthetic dataset
covering **2024-01-01 to 2026-08-26**, seeded with a small
Mulberry32 PRNG so every process/run/test observes byte-identical rows
(`hashString(date|packageId|saleType|countryCode)` seeds each row's
randomness, so results are stable across re-runs and don't depend on
call order).

- 13 countries with distinct currencies, base prices (local minor
  units), weights and tax rates, including `XC` (Steam China, CNY,
  0% mock tax rate) and `RU`.
- Both catalogue products (MZ, MV) with their full base/DLC/bundle
  package sets, including packages with `activeFrom`/`activeUntil`
  windows (e.g. legacy retail packages that stop appearing after a
  date) and one DLC/bundle pairing.
- One Retail/CD-key package per product, generating activation-only
  rows (all monetary and Steam-sales fields zeroed, `gross_units_activated`
  populated) — structurally distinct from Steam Store rows.
- 14 seasonal discount windows spread across the full date range, so
  discount-detection, effective-discount and bundle-participation logic
  are actually exercised, not just unit-tested with example rows.
- Deliberate cents-level noise (`round(x, 4)` jitter) on `gross_sales_usd`
  etc., so the calendar-month TRUNC rules produce genuinely different
  results than a naive sum — this is what lets `mockRepository.test.ts`
  assert "calendar-month Revenue Share differs from a raw
  `revenue_share_usd` sum" against realistic-shaped data.
- Returns are generated as a small, semi-random fraction of units (stored
  signed negative, consistent with the real schema).

**How this differs from BigQuery in Phase 2:**

1. **Volume and shape.** The fixture set is small enough to hold in
   memory for a single Node process (`mockRows()` caches a generated
   array). Real `detailed_sales` is unbounded and partitioned — Phase 2
   must aggregate in SQL, not in application memory.
2. **Determinism.** Mock data is exactly reproducible; production data
   is not, and freshness (`getFreshness`) will reflect an actual
   ingestion cadence rather than a fixed range constant (`MOCK_RANGE`).
3. **Correctness surface.** The mock generator itself encodes the
   `TRUNC`/rounding rules only incidentally (as a way to make them
   testable); it is not a substitute for validating the formulas against
   real warehouse rows. **Reconciling Phase 2's SQL output against known-
   correct GGG figures for at least one real month is not yet done and
   should be a Phase 2 acceptance gate** (see §14).
4. **Retail territory data.** Mock `territory_code_description` is a
   synthetic string (`"{region} territory"`); real values and their
   cardinality are unknown.
5. **Multi-currency pricing.** The mock generator computes a
   `base_price`/`sale_price` per country consistently from one
   `priceFactor`; real per-country pricing may not follow a single
   multiplicative relationship to the US/USD reference price the way the
   mock does.

The mock repository (`MockSalesRepository`) delegates **all aggregation**
to the same `src/domain/metrics.ts` functions the BigQuery SQL is
designed to reproduce, specifically so the two can be reconciled
row-for-row once BigQuery is connected — the domain layer, not the data
source, is the single source of truth for formulas.

## 7. Repository interface and mock/bigquery switching

- Interface: `SalesRepository` in `src/data/repository.ts` (§3 above lists
  its methods).
- Selection: `src/data/index.ts`, guarded by `import 'server-only'`:
  ```ts
  export function getRepository(): SalesRepository {
    if (instance) return instance;
    const source = process.env.DATA_SOURCE ?? 'mock';
    instance = source === 'bigquery' ? createBigQueryRepository() : new MockSalesRepository();
    return instance;
  }
  ```
  A module-level singleton, instantiated lazily on first access and
  cached for the process lifetime. `DATA_SOURCE` unset or anything other
  than `"bigquery"` defaults to mock.
- `createBigQueryRepository()` in `src/data/bigquery/bigqueryRepository.ts`
  currently **always throws** `BigQueryNotConfiguredError` — selecting
  `DATA_SOURCE=bigquery` today fails loudly at first use rather than
  returning empty or fabricated data. This is intentional Phase 1
  behavior, not a bug.
- No component ever imports `mockRepository.ts` or
  `bigqueryRepository.ts` directly; every page reaches the repository
  through `loadPageContext()` (`src/lib/pageContext.ts`), which also
  resolves the product, scope and date-range bounds for that request from
  `repository.getFreshness()`.

## 8. BigQuery SQL currently implemented or planned

`src/data/bigquery/sql.ts` holds parameterised query **builders** (not
bare exported SQL strings — see the file's own doc comment for why: an
earlier revision's bare exported strings let a query builder forget to
apply the package filter). Nothing in this file executes yet; it exists
so the SQL can be reviewed against `docs/METRICS.md` before any
credential is provisioned. Builders present:

| Builder | Purpose |
|---|---|
| `buildDailySalesQuery` | Fine-grain daily money + units, `GROUP BY date` |
| `buildMonthlySalesQuery` | Calendar-month rule: CTE aggregates to month × `packageid`, then `TRUNC`s each component to cents before summing; also computes `monthly_basic_70` inline |
| `buildMonthlyAdditionalRevenueShareQuery` | Tiered additional Revenue Share: month × package × appid × tier → truncate → re-aggregate by month × appid × tier → apply tier rate, `ROUND` |
| `buildCountryPerformanceQuery` | Fine-grain, `GROUP BY country_code` |
| `buildPricingTimelineQuery` | Per-day reference-market price via `ARRAY_AGG(... ORDER BY gross_units_sold DESC LIMIT 1)`, plus scope-wide unit/money aggregates and bundle participation |
| `buildDlcPerformanceQuery` | AppID-level, excludes base + bundle packages |
| `buildPackagePerformanceQuery` | AppID-level, every package, unfiltered by kind |
| `buildRetailActivationsQuery` | `package_sale_type = 'Retail'`, units only |
| `buildFreshnessQuery` | `MIN(date)`/`MAX(date)` over a range |

Shared rules encoded in `scopedWhere()` and applied to every scoped
builder:
- Date partition filter (`date BETWEEN @startDate AND @endDate`) on
  every query.
- `line_item_type = 'Package' AND package_sale_type = @packageSaleType AND primary_appid = @primaryAppId`.
- `base` scope adds `packageid IN UNNEST(@basePackageIds)`, resolved from
  the same `PRODUCT_CATALOG` the domain layer uses (so scope logic cannot
  drift between SQL and application code).
- `dlc` scope adds `packageid NOT IN UNNEST(@nonDlcPackageIds)` (base +
  bundle packages excluded).
- `app` scope adds no package filter — the only kind that intentionally
  means "everything under this AppID."
- All values are **named parameters** (`@startDate`, `@basePackageIds`,
  etc.) — never string-interpolated. The only string interpolation in
  the file is the fixed table-name constant `TABLE`.
- `TRUNC` is used for the calendar-month components; `ROUND`/`FLOOR` are
  never substituted for it. `ABS()` never appears.
- `SCOPED_QUERY_BUILDERS` is an explicit registry of every scope-taking
  builder; `tests/bigquerySql.test.ts` iterates it so a new scoped query
  cannot be added without the same checks automatically covering it.

`tests/bigquerySql.test.ts` (49 tests) asserts these properties against
the builders' **string/params output** — it checks SQL shape and
parameterization, not execution, since there is no BigQuery connection in
Phase 1. **These queries have not been run against real BigQuery and
their output has not been reconciled against known-correct figures** —
flagged explicitly for Phase 2 (§10, §14).

## 9. Environment variables required for BigQuery

From `.env.example`:

```bash
# Data source for the repository layer: "mock" (Phase 1) or "bigquery" (Phase 2, not yet enabled).
DATA_SOURCE=mock

# --- Phase 2 / BigQuery (read-only, server-side only. NEVER expose to the browser) ---
# BigQuery is read-only. No NEXT_PUBLIC_ prefix is permitted for any of these.
# BIGQUERY_PROJECT_ID=ggg-dashboard-494707
# BIGQUERY_DATASET=sales_steam
# BIGQUERY_LOCATION=asia-northeast1
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/read-only-key.json
```

None of these are read by any code yet (`createBigQueryRepository()`
throws before ever reaching credentials); they document the intended
Phase 2 shape. `tests/architecture.test.ts` asserts:
- no `NEXT_PUBLIC_` variable name containing `BIGQUERY|GOOGLE|CREDENTIAL|PROJECT|DATASET|KEY` exists anywhere in `src/`;
- `.env.example` never pairs `NEXT_PUBLIC_` with those terms, and every
  line mentioning `CREDENTIALS|PROJECT_ID|DATASET` is commented out;
- `.gitignore` ignores `.env*`, `*.pem`, and service-account JSON
  filename patterns.

On Cloud Run, the intended model (per `README.md`) is: BigQuery
configuration arrives as environment variables plus the **service
account attached to the Cloud Run revision** (not a checked-in key
file), with a read-only role scoped to the `sales_steam` dataset.

## 10. Known limitations, assumptions, TODOs, and open questions

All of `docs/OPEN_QUESTIONS.md` is unresolved and directly relevant; the
items raised during Phase 1 implementation are the most load-bearing for
a Phase 2 reviewer:

1. **FY monetary aggregation is a sum-of-months, not a true FY-grain
   TRUNC** (Q11) — the single item most likely to change reported cents
   if GGG's finance team expects a fiscal-year intermediate grain.
2. **Arbitrary multi-day ranges use the fine-grain rule**, not a
   composition of calendar-month results (Q10) — confirm this is the
   intended reading of `METRICS.md` for ranges that happen to span whole
   months.
3. **Comparable-period delta window** (equal-length immediately-preceding
   range) is a Phase 1 choice, not specified in `UI_SPEC.md` (Q12).
4. **MV's current base package** is left undefined (no `currentBasePackageId`
   set for MV in `PRODUCT_CATALOG`) — `METRICS.md` only states MZ's (Q13).
5. **Return Rate is units-only**; a value-based return rate (returns USD
   / gross USD) is not implemented and not requested by `METRICS.md` (Q14).
6. **Country-level Revenue Share does not reconcile with the
   calendar-month figure** — a direct consequence of country being a
   fine-grain dimension (Q15); see §4.
7. **Community Market Game Fee is absent from the warehouse** and
   therefore from Revenue Share; internal NET is incomplete for titles
   with Market activity (Q16).
8. **Pricing is pinned to a single reference market (US/USD)** — resolved
   for Phase 1, but confirm this is the right reference market and
   whether a per-market pricing view is needed later (Q17).
9. **Retail activation view ownership** is unresolved — which team owns
   it and whether it needs its own tab (Q18).
10. Production authentication/SSO, final Cloud Run project/domain,
    canonical store-metadata source, canonical sale/event dataset,
    Reviews/Wishlist ingestion scope, external bundle/event
    normalization, competitor-mode placement, and role-based visibility
    for financial metrics are all **unresolved** (Q1–Q9).

Additional implementation-level notes not in `OPEN_QUESTIONS.md`:

- `classifyPackage()` defaults an unrecognized `packageid` under a known
  AppID to `dlc` rather than rejecting it (§3) — worth confirming this
  fallback is safe for real data, where an unexpected package could
  appear for reasons other than "it's DLC" (e.g. a data error).
- The BigQuery SQL builders are unexecuted and unreconciled against real
  data (§8) — this is the primary Phase 2 acceptance risk, not a code
  defect.
- No caching layer exists yet; `docs/DATA_MODEL.md` asks for common
  server queries to be cached and for the app to never query the full
  portfolio on each page load — Phase 1 has no query volume to cache
  against (mock data is in-memory), so this is entirely deferred to
  Phase 2.
- No role-based access control exists; every page is visible to anyone
  who can reach the Cloud Run service (see §12).
- Reviews and Updates tabs are placeholders with no ingestion source
  identified yet (Q5).

## 11. Test coverage and what each test verifies

11 test files, 169 tests, all passing at generation time (`npm run
verify`: lint clean, `tsc --noEmit` clean, `vitest run` 169/169).

| File | Tests | Verifies |
|---|---|---|
| `tests/architecture.test.ts` | 12 | No SQL/warehouse-table name/BigQuery import in any UI file; `server-only` guards on `data/index.ts` and `lib/pageContext.ts`; no data-layer file is a client component; no `NEXT_PUBLIC_` variable exposes BigQuery config; `.env.example` and `.gitignore` keep credentials out; `Math.abs()` appears nowhere outside `numeric.ts`; the 70% Revenue Share factor appears only inside the documented `TRUNC(ROUND(net,3)*0.70,2)` expression, never as a bare multiplier elsewhere |
| `tests/bigquerySql.test.ts` | 49 | Every scoped SQL builder restricts `base` scope to the product's actual Package family (not a hard-coded one); an unregistered AppID throws instead of falling back to `primary_appid`; the DLC query excludes base and bundle packages and is Steam-only; every AppID-level query has a date filter; pricing never mixes currencies (reference-market pin, no cross-country `ANY_VALUE` on price fields, discount computed only when `base_price > 0`, unit/money columns stay scope-wide); no string-interpolated values (only the table constant), no `ABS()`, no `SELECT *`/DML (read-only), `TRUNC` intact in the calendar-month query |
| `tests/country.test.ts` | 4 | `XC` renders as the mandated Steam China label; `"Unknown Country"` alone also maps to Steam China; other countries render as `Name (Code)`; falls back to code with no name |
| `tests/dates.test.ts` | 6 | Day arithmetic across month/year boundaries; inclusive day counts; month bounds including leap February; `previousRange` computation; inclusive date enumeration; malformed dates rejected rather than coerced |
| `tests/fiscal.test.ts` | 4 | Apr–Dec maps to the same-numbered FY, Jan–Mar to the previous FY; FY2025 bounds exactly `2025-04-01..2026-03-31`; month labelling/enumeration in fiscal order |
| `tests/format.test.ts` | 11 | `null`/`undefined`/`NaN`/`Infinity` render as "No data", never zero; genuine zero still renders as zero; USD to 2 decimals; negative sign preserved on returns; rate formatting; minor-units formatting with currency; unit formatting without decimals; comparable-period delta is `null` when previous is 0; delta is explicitly signed; date range always shows both ends |
| `tests/metrics.test.ts` | 22 | Unit metrics (gross/returned-signed/net/Return Rate, null when no gross units, net_units_sold used as-is not derived); fine-grain money sums raw values with sign preserved; calendar-month money truncates each package-month component to cents *before* summing (and this differs from truncating the whole-month total in one step); negative returns truncate toward zero; calendar-month Revenue Share applies basic 70% per package-month via the documented `TRUNC(ROUND(net,3)*0.70,2))` (not a raw `revenue_share_usd` sum); tiered additional component adds 5%/10% aggregated by month×appid×tier, ignores untiered rows, keeps separate appids in separate buckets, and the total is basic+additional (never a blanket `Net*70%`); `sumSalesMetrics` recomputes the rate from summed units rather than averaging rates; effective discount formula and its null cases; retail activation counting never touches monetary fields; `monthKey` extraction |
| `tests/mockRepository.test.ts` | 26 | Fixture determinism, window bounds, signed returns, Retail rows carry zero Store money, Steam China rows exist; repository reports `source: 'mock'`; base scope < app-scope revenue; Retail never mixes into Store money; retail activations grouped by package **and** territory (not merged under one label); daily fine-grain sums reconcile to the range total; monthly rows labelled `calendar-month` and match the documented rule; partial-month/partial-FY flags are set correctly, including when no earlier data exists; calendar-month Revenue Share differs from a raw `revenue_share_usd` sum; FY aggregation runs Apr–Mar; Steam China labelling and sales-share computation; `getDlcPerformance` never returns base or bundle packages (incl. MV Bundle exclusion); `getPackagePerformance` returns and labels every package; DLC total excludes base revenue; overview's top-DLC panel never contains a base package; pricing reports only the reference-currency observation and matches the correct fixture row (not another country's); overview includes a comparable preceding period; discounted periods are detected without inventing names |
| `tests/numeric.test.ts` | 6 | `TRUNC` truncates toward zero for positive and negative values (differs from `ROUND`); truncation is not defeated by IEEE-754 floating-point representation error; `ROUND` rounds halves away from zero (differs from JS `Math.round`, which is half-toward-`+Infinity`); `safeDivide` returns `null` instead of `NaN`/`Infinity` |
| `tests/pricing.test.ts` | 13 | Observed effective discount computed per day; preferred over `total_discount_percentage`; bundle participation alone is not treated as a discount; contiguous discounted days group into one period, a gap splits them; no event name is ever invented; reference market is US/USD; price is taken from the reference market even when another market sells more units; currency never reported as non-reference; a non-reference-market discount alone produces no reported discount; a day with no reference-market row reports "No data" rather than borrowing a currency; a US row in a non-reference currency is ignored for pricing; unit/money aggregates stay scope-wide, not reference-market-only |
| `tests/scope.test.ts` | 16 | Product catalogue encodes the documented base Package families for both MZ and MV; unknown AppID throws; catalogue is not single-title; base scope accepts only the base family and rejects same-appid DLC, the MV Bundle, Retail rows under a Steam scope, other AppIDs, and non-`Package` line items; base-scope total is strictly smaller than app-scope total; DLC scope accepts non-base packages; `classifyPackage` labels base/bundle/DLC; SQL parameter resolution; scope description always states the package family and sales channel, and labels Retail distinctly |

`tests/architecture.test.ts` and `tests/bigquerySql.test.ts` together are
the mechanism that turns the safeguards in `CLAUDE.md` (no SQL in
components, `server-only` boundary, no `NEXT_PUBLIC_` BigQuery leak,
mandatory date partition filter, named parameters only, no `ABS()`, no
`ROUND`/`FLOOR` substituted for `TRUNC`) into something that fails CI
rather than relying on review discipline alone.

## 12. Security considerations

- **No client-side BigQuery access.** `import 'server-only'` on
  `src/data/index.ts` and `src/lib/pageContext.ts` makes any accidental
  client-component import of the data layer a **build failure**, not a
  runtime leak. Verified by `tests/architecture.test.ts`.
- **No SQL in the browser.** `tests/architecture.test.ts` greps every
  file under `src/app` and `src/components` for SQL statement patterns,
  the literal warehouse table name, and `@google-cloud/bigquery` imports
  — all must be absent.
- **No credential in the client bundle.** No environment variable name
  containing `BIGQUERY|GOOGLE|CREDENTIAL|PROJECT|DATASET|KEY` may carry
  the `NEXT_PUBLIC_` prefix anywhere in `src/`; only `NEXT_PUBLIC_`-
  prefixed variables are exposed to the browser by Next.js, so this is
  the actual leak boundary, not a style preference.
- **Secrets stay out of the repo and the image.** `.gitignore` and
  `.dockerignore` both exclude `.env*` (except `.env.example`), `*.pem`,
  and common service-account key filename patterns. `.env.example`
  contains no real values.
- **No credential baked into the Cloud Run image.** The `Dockerfile`
  copies only `package.json`/`package-lock.json`, source, and the build
  output; BigQuery config is expected to arrive via Cloud Run environment
  variables and the **service account attached to the revision**, per
  `README.md`.
- **Runs unprivileged.** The Cloud Run image creates and switches to a
  non-root `nextjs` user (`Dockerfile`) rather than running as root.
- **BigQuery is intended read-only.** `docs/DATA_MODEL.md` and
  `CLAUDE.md` both state this; `tests/bigquerySql.test.ts` asserts the
  generated SQL contains no `SELECT *`/DML statement shape. There is
  **no code-level enforcement that the actual GCP service account is
  read-only** — that is an IAM configuration step for Phase 2, outside
  what this repository can guarantee by itself. Flag this explicitly to
  the reviewer as an infra/IAM action item, not a code gap.
- **No authentication/authorization is implemented at all.** `docs/OPEN_QUESTIONS.md`
  #1 and #9 are both unresolved: production SSO/authentication for the
  deployed service, and whether financial metrics need role-based
  visibility. As implemented, anyone who can reach the Cloud Run URL
  sees full financial data for every registered product. The `README.md`
  deploy example uses `--no-allow-unauthenticated`, which restricts
  invocation to IAM-authorized callers at the Cloud Run layer — but this
  is a deploy-time flag, not something the application enforces or tests
  guarantee, and it has not been paired with a specific IAM policy in
  this repository. **This should be resolved and load-bearing before any
  Phase 2 production deployment**, not left as an infra afterthought.
- **URL parameters are the only user input surface** (`src/lib/params.ts`):
  date range, scope kind, grain, metric, search string, region, min-units
  filter. All are validated/coerced (ISO-date regex, allow-listed enum
  values, `Number()` + finiteness checks) before use; none are
  interpolated into SQL (Phase 2 builders take structured `Scope`/
  `DateRange` objects, not raw search-param strings). No `dangerouslySetInnerHTML`
  or similar was observed in the components reviewed.
- **No secrets are committed** in the current repository state (verified
  by inspection of `.env.example`, `.gitignore`, `.dockerignore`, and the
  absence of any tracked `.env`/key file).

## 13. Files to inspect most carefully before approving Phase 2

In priority order:

1. **`src/domain/metrics.ts`** — every financial formula. This is the
   single most consequential file: an error here is wrong in every
   surface at once. Cross-check line-by-line against `docs/METRICS.md`,
   especially the Revenue Share basic+additional components (§4) and the
   FY sum-of-months assumption (§10 item 1).
2. **`src/data/bigquery/sql.ts`** — the SQL that will replace this logic
   in Phase 2. It has never executed against real BigQuery. Confirm each
   builder's SQL actually reproduces `metrics.ts`'s formula when read as
   a human, since `tests/bigquerySql.test.ts` checks shape/parameters,
   not numeric output.
3. **`src/domain/scope.ts`** and `PRODUCT_CATALOG` — the base/DLC/bundle
   package-family definitions are hand-transcribed from `METRICS.md` and
   are the sole guard against `primary_appid`-only aggregation. Any new
   product onboarded in Phase 2 needs a correct entry here; a missing or
   wrong package id silently mis-scopes that product only (the code
   throws for *unregistered* AppIDs, but not for a *wrong* package list).
4. **`src/domain/numeric.ts`** — the `TRUNC`/`ROUND` reimplementations
   that must match BigQuery's semantics exactly (truncate-toward-zero,
   round-half-away-from-zero) including the floating-point snapping
   logic (`snap()`). A subtle divergence here would silently shift cents
   across every calendar-month figure.
5. **`docs/OPEN_QUESTIONS.md`**, items 10–18 — these are unresolved
   business decisions embedded as code assumptions. Phase 2 should not
   proceed on the FY-aggregation and country-Revenue-Share-reconciliation
   points (in particular) without an explicit business answer, since
   both affect displayed cents.
6. **`src/data/mock/fixtures.ts`** — confirm the reviewer understands
   this is synthetic data with a specific generation model (§6), not a
   sample of real GGG figures, before using it to sanity-check any
   Phase 2 output.
7. **`tests/architecture.test.ts`** and **`tests/bigquerySql.test.ts`** —
   the safeguard mechanism itself. Confirm these guards are sufficient
   and will not become vacuous (as the file's own comment notes happened
   once before, when exported SQL strings turned into builder functions
   and two assertions kept passing against zero parsed queries).
8. **Deployment/IAM configuration** (not yet in this repo) — the
   read-only BigQuery service account and the authentication/authorization
   story for the deployed Cloud Run service (§12) are both unresolved and
   should be closed out before Phase 2 goes to production, even though
   they are infra rather than application code.

## 14. Recommended Phase 2 implementation plan

1. **Resolve the outstanding business questions first**, at minimum:
   FY-aggregation grain (Q11), the arbitrary-range aggregation rule
   (Q10), country-level Revenue Share reconciliation (Q15), Community
   Market Game Fee sourcing (Q16), and MV's current base package (Q13).
   Update `docs/METRICS.md` and `docs/OPEN_QUESTIONS.md` with the
   answers before writing new formula code, per the workflow in
   `CLAUDE.md` ("Ambiguities go to `docs/OPEN_QUESTIONS.md`; do not
   guess").
2. **Provision a read-only BigQuery service account** scoped to the
   `sales_steam` dataset (or the `detailed_sales` table specifically, if
   BigQuery IAM allows table-level scoping), attach it to the Cloud Run
   revision, and confirm the address of the required
   `GOOGLE_APPLICATION_CREDENTIALS`/ADC path is never a checked-in key
   file (§12).
3. **Implement `createBigQueryRepository()`** in
   `src/data/bigquery/bigqueryRepository.ts`, mapping the query builders
   in `sql.ts` onto the `SalesRepository` interface and the domain types
   in `src/domain/types.ts`. Keep aggregation logic that duplicates
   `metrics.ts` to a minimum — prefer doing as much of the truncation/
   rounding as SQL already does, and let the two implementations diverge
   as little as possible.
4. **Reconcile against known-correct figures.** Before trusting any
   Phase 2 output, run the new repository against at least one real
   calendar month for RPG Maker MZ (the validation title) and compare
   Gross Sales, Revenue Share (both components), Net Units, and Return
   Rate against GGG's existing authoritative figures for that month.
   Treat any mismatch as a formula bug until proven otherwise — do not
   adjust the formula to match a mismatch without documenting why in
   `docs/METRICS.md`.
5. **Extend the test suite** with integration-style tests that run the
   real BigQuery builders (or a BigQuery emulator/dry-run, if available)
   against a small fixture table, so `tests/bigquerySql.test.ts`'s
   string-shape assertions get an execution-level counterpart.
6. **Add caching** for the server-side queries the `Overview` and `Sales`
   pages issue on every load, per `docs/DATA_MODEL.md`'s "cache common
   server queries; never query full portfolio on each page load."
   Decide cache invalidation against the warehouse's actual ingestion
   cadence.
7. **Resolve authentication/authorization** for the deployed service
   (Q1, Q9) before any Phase 2 production rollout — this gates data
   exposure, not just data correctness, and should not slip behind the
   BigQuery integration work.
8. **Re-run `npm run verify`** (lint + typecheck + tests) and the full
   architecture-guard suite after every change to `sql.ts` or
   `bigqueryRepository.ts`, since those guards are what keeps the
   Phase 1 safeguards (date partition filter, named parameters, no
   `ABS()`, no `ROUND`/`FLOOR` substitution, base-scope package-family
   restriction) load-bearing through Phase 2.
9. **Only after (1)–(8)**, extend product coverage beyond MZ/MV and
   revisit the deferred items in `docs/OPEN_QUESTIONS.md` (Reviews/
   Wishlist ingestion, canonical event dataset, competitor mode) as
   separate, later phases — per `CLAUDE.md`'s workflow, each should get
   its own docs update and plan before implementation begins.

---

*This document was generated by inspecting the repository at the commit
noted above and running `npm run verify`. It does not modify application
code, and Phase 2 has not been started.*
