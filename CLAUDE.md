# GGG Steam Intelligence — Claude Code Instructions

## Mission
Build an internal GGG Steam intelligence web application combining Steam product/store context with GGG authoritative internal Steam financial data.

## Source of truth
- `/docs/REQUIREMENTS.md`: MVP requirements
- `/docs/METRICS.md`: authoritative metric definitions
- `/docs/DATA_MODEL.md`: data/query rules
- `/docs/UI_SPEC.md`: UI specification
- If code and docs disagree, docs win. Never invent financial formulas.
- Ambiguities go to `docs/OPEN_QUESTIONS.md`; do not guess.

## Engineering rules
- Next.js + TypeScript; target Google Cloud Run.
- BigQuery is server-side and read-only. Never expose credentials or raw access to the browser.
- Never commit secrets or `.env*`.
- Parameterize SQL. Every `detailed_sales` query requires a `date` partition filter.
- Keep Steam Store sales and Retail/CD-key activations separate.
- SQL belongs in a repository/data layer, never React components.
- First build with mock fixtures; connect BigQuery only after UI and tests are stable.
- Add tests for metric formulas and product-scope rules.

## Financial safeguards
- A parent `primary_appid` is not automatically the base product; use Package families in `METRICS.md`.
- Retail activations are not sales revenue.
- Return fields are signed negative. Do not use `ABS()` in financial calculations.
- Calendar-month monetary aggregation uses the documented truncation rules.
- Revenue Share is not blanket `Net * 70%`; additional tiers exist.

## Workflow
1. Read all `/docs`.
2. Propose an implementation plan.
3. Implement Phase 1 with mock data.
4. Add tests; run lint/typecheck/tests.
5. Implement BigQuery repository layer.
6. Report tests, unresolved TODOs and assumptions before claiming completion.
