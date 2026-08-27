# GGG Steam Intelligence

Internal GGG Steam intelligence web application: Steam product/store context
alongside GGG authoritative internal Steam financial data.

`CLAUDE.md` and everything under `/docs` are the source of truth. If this README
and those documents disagree, the documents win.

## Stack
Next.js (App Router) + TypeScript, server-side read-only BigQuery, Google Cloud Run.

## Phase 1 status

Implemented against **mock fixtures only**. BigQuery is not connected.

| Tab | State |
|---|---|
| Overview | Implemented — KPI cards, daily timeline, top countries, top DLC, detected discounted periods |
| Sales | Implemented — daily / calendar-month / fiscal-year grains, full metric table |
| Pricing & Sales | Implemented — observed effective discount, detected periods, daily price observations |
| Countries | Implemented — ranking, search/region/sort/minimum-units filters, sales share |
| DLC | Implemented — package list with type labels, filters, per-package detail |
| Reviews | `data not yet connected` placeholder |
| Updates | `data not yet connected` placeholder |

## Getting started

```bash
npm install
cp .env.example .env.local     # DATA_SOURCE=mock
npm run dev                    # http://localhost:3000
```

The entry point redirects to the first product in the catalogue. RPG Maker MZ
(AppID `1096900`) is the validation title; RPG Maker MV (AppID `363890`) is
registered alongside it so the UI is demonstrably not MZ-specific.

## Checks

```bash
npm run verify     # lint + typecheck + tests
npm run lint
npm run typecheck
npm test
npm run build
```

## Architecture

```
src/domain/     Pure logic: metric formulas, product scope, fiscal year, formatting.
                No SQL, no React. This is what the test suite targets.
src/data/       Repository boundary. `mock/` today, `bigquery/` in Phase 2.
                Guarded by `import 'server-only'`.
src/app/        App Router pages. Server Components fetch through the repository.
src/components/ Presentation only.
tests/          Vitest suite for metric formulas and scope rules.
```

### Rules the code enforces

- **Scope.** A base-product total is resolved through an explicit Package family
  in `src/domain/scope.ts`, never from `primary_appid` alone. An unregistered
  AppID throws rather than producing a silently wrong total.
- **Channels.** Steam Store sales and Retail/CD-key activations are separate
  types on separate queries. Activations are counts, never revenue.
- **Signs.** Returns stay signed negative. `Math.abs` is banned by an ESLint rule;
  the sole exemption is `src/domain/numeric.ts`, which implements BigQuery's
  `TRUNC`/`ROUND` primitives and performs no financial aggregation.
- **Rounding.** `TRUNC` truncates toward zero and is never replaced by `ROUND` or
  `FLOOR`. `ROUND` is half-away-from-zero, matching BigQuery rather than
  JavaScript's `Math.round`.
- **Aggregation.** Every monetary figure in the UI states whether it came from the
  fine-grain rule or the calendar-month rule.
- **Honesty.** Missing data renders as `No data`, never zero. Discounted stretches
  are labelled `Detected discounted period` because no canonical event source
  exists; no event name is invented and no causality is implied.

## BigQuery (Phase 2, not connected)

`src/data/bigquery/sql.ts` holds the parameterised SQL that will replace the mock
aggregation, written so it can be reviewed against `docs/METRICS.md` before any
credential exists. Every `detailed_sales` query carries a `date` partition
filter. `src/data/bigquery/bigqueryRepository.ts` throws rather than returning
empty or fabricated data. Selecting `DATA_SOURCE=bigquery` fails loudly today.

Credentials are server-side and read-only. No BigQuery value may ever reach a
`NEXT_PUBLIC_` variable or the browser.

## Mock data

Fixtures are generated deterministically from a seeded PRNG in
`src/data/mock/fixtures.ts`, covering 2024-01-01 to 2026-08-26. They are
synthetic and are labelled as such in the UI on every page. They are not GGG
actuals and must not be quoted as such.
