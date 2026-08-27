/**
 * Phase 2 placeholder.
 *
 * The BigQuery client is deliberately not wired up yet: CLAUDE.md requires the
 * mock UI, typecheck, lint and tests to be stable first. Selecting this source
 * fails loudly rather than silently returning empty or fabricated data.
 *
 * When implemented it must:
 *   - run server-side only, with read-only credentials, in asia-northeast1;
 *   - use the parameterised SQL in ./sql.ts, always with a `date` partition filter;
 *   - map result rows onto the same domain types the mock repository returns.
 */
export class BigQueryNotConfiguredError extends Error {
  constructor() {
    super(
      'The BigQuery repository is not implemented yet (Phase 2). Set DATA_SOURCE=mock until it is connected.',
    );
    this.name = 'BigQueryNotConfiguredError';
  }
}

export function createBigQueryRepository(): never {
  throw new BigQueryNotConfiguredError();
}
