import 'server-only';

import { notFound } from 'next/navigation';
import { getRepository } from '@/data';
import { createScope, findProduct, type ProductDefinition } from '@/domain/scope';
import type { DataFreshness, DateRange, Scope } from '@/domain/types';
import { resolveParams, type ResolvedParams, type SearchParams } from './params';
import type { SalesRepository } from '@/data/repository';

export interface PageContext extends ResolvedParams {
  readonly product: ProductDefinition;
  readonly scope: Scope;
  readonly repository: SalesRepository;
  readonly freshness: DataFreshness;
  readonly bounds: DateRange;
  readonly searchParams: SearchParams;
  readonly pathname: string;
}

/**
 * Resolves the product, date range and scope for a page.
 *
 * Every page goes through here so the date range is always bounded by what the
 * warehouse actually holds and the scope is always explicit — never implied.
 */
export async function loadPageContext(
  params: Promise<{ appId: string }>,
  searchParamsPromise: Promise<SearchParams>,
  tab: string,
): Promise<PageContext> {
  const [{ appId }, searchParams] = await Promise.all([params, searchParamsPromise]);
  const product = findProduct(Number(appId));
  if (!product) notFound();

  const repository = getRepository();
  const freshness = await repository.getFreshness();
  if (!freshness.earliestDate || !freshness.latestDate) {
    throw new Error('The data source reported no available dates; a date partition filter cannot be built.');
  }

  const bounds: DateRange = { start: freshness.earliestDate, end: freshness.latestDate };
  const resolved = resolveParams(searchParams, bounds);

  return {
    ...resolved,
    product,
    scope: createScope(product.appId, resolved.scopeKind),
    repository,
    freshness,
    bounds,
    searchParams,
    pathname: `/apps/${product.appId}/${tab}`,
  };
}
