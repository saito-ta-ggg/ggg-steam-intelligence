# GGG Steam Intelligence Starter

Specification pack for Claude Code implementation.

## Stack
Next.js + TypeScript + server-side read-only BigQuery + Google Cloud Run.

## First Claude Code instruction
> Read `CLAUDE.md` and every file under `/docs` and treat them as the source of truth. First propose the Phase 1 implementation plan and directory structure. Then implement the mock-data version of Overview, Sales, Countries and DLC, including metric/scope unit tests. Do not connect production BigQuery until mock UI, typecheck, lint and tests pass. Do not guess unresolved specifications; add them to `docs/OPEN_QUESTIONS.md`.

## Sequence
1. Scaffold Next.js/TypeScript.
2. Typed domain models + mock fixtures.
3. App shell/product/date/scope controls.
4. Overview/Sales/Countries/DLC.
5. Charts after tables work.
6. Metric/scope tests.
7. Server-side BigQuery repository.
8. Read-only local BigQuery connection via environment variables.
9. Reconcile MZ against known analysis outputs.
10. Cloud Run deployment preparation.

Validation title: RPG Maker MZ, AppID `1096900`; base Packages `481511`,`369820`,`488238`.
