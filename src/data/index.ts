import 'server-only';

import { MockSalesRepository } from './mock/mockRepository';
import { createBigQueryRepository } from './bigquery/bigqueryRepository';
import type { SalesRepository } from './repository';

let instance: SalesRepository | null = null;

/**
 * Server-side accessor for the data layer.
 *
 * `import 'server-only'` makes it a build error for any client component to reach
 * this module, which is what keeps BigQuery credentials and raw query access off
 * the browser (CLAUDE.md, docs/DATA_MODEL.md).
 */
export function getRepository(): SalesRepository {
  if (instance) return instance;
  const source = process.env.DATA_SOURCE ?? 'mock';
  instance = source === 'bigquery' ? createBigQueryRepository() : new MockSalesRepository();
  return instance;
}

export type { SalesRepository } from './repository';
