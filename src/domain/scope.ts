import type {
  DetailedSalesRow,
  PackageKind,
  PackageSaleType,
  Scope,
  ScopeKind,
} from './types';

/**
 * Product catalogue.
 *
 * METRICS.md, "Product scope": a bare product title means the base product only,
 * DLC excluded, and `primary_appid` alone must NOT be used for base-product totals.
 * The base product is therefore resolved through an explicit Package family.
 *
 * Only facts stated in docs/METRICS.md are encoded here. Fields the docs do not
 * state (e.g. the current base package for MV) are left undefined rather than guessed.
 */
export interface ProductDefinition {
  readonly appId: number;
  readonly name: string;
  /** Package family that constitutes the base product. */
  readonly basePackageIds: readonly number[];
  /** The package currently on sale, when the docs state one. */
  readonly currentBasePackageId?: number;
  /** Packages that are bundles rather than base product or DLC. */
  readonly bundlePackageIds?: readonly number[];
}

export const PRODUCT_CATALOG: readonly ProductDefinition[] = [
  {
    appId: 1096900,
    name: 'RPG Maker MZ',
    basePackageIds: [481511, 369820, 488238],
    currentBasePackageId: 488238,
  },
  {
    appId: 363890,
    name: 'RPG Maker MV',
    basePackageIds: [65464, 80322],
    // METRICS.md: 88038 is the MV Bundle and is excluded from the base product.
    bundlePackageIds: [88038],
  },
];

export function findProduct(appId: number): ProductDefinition | undefined {
  return PRODUCT_CATALOG.find((product) => product.appId === appId);
}

export function requireProduct(appId: number): ProductDefinition {
  const product = findProduct(appId);
  if (!product) {
    throw new Error(
      `Unknown AppID ${appId}. Add it to PRODUCT_CATALOG with its base Package family before querying base-product totals.`,
    );
  }
  return product;
}

/** Classify a package under a product. Anything not declared base or bundle is DLC. */
export function classifyPackage(product: ProductDefinition, packageId: number): PackageKind {
  if (product.basePackageIds.includes(packageId)) return 'base';
  if (product.bundlePackageIds?.includes(packageId)) return 'bundle';
  return 'dlc';
}

export function createScope(
  appId: number,
  kind: ScopeKind = 'base',
  saleType: PackageSaleType = 'Steam',
): Scope {
  requireProduct(appId);
  return { appId, kind, saleType };
}

/**
 * Row-level scope predicate. Mirrors the WHERE clause the BigQuery repository builds:
 *
 *   line_item_type = 'Package'
 *   AND package_sale_type = @saleType
 *   AND primary_appid = @appId
 *   AND packageid IN UNNEST(@packageIds)   -- for 'base' and 'dlc'
 */
export function matchesScope(row: DetailedSalesRow, scope: Scope): boolean {
  if (row.line_item_type !== 'Package') return false;
  if (row.package_sale_type !== scope.saleType) return false;
  if (row.primary_appid !== scope.appId) return false;

  const product = requireProduct(scope.appId);
  switch (scope.kind) {
    case 'base':
      return product.basePackageIds.includes(row.packageid);
    case 'dlc':
      return classifyPackage(product, row.packageid) === 'dlc';
    case 'app':
      return true;
  }
}

/** Package ids a `base` or `dlc` scope resolves to, for display and for SQL parameters. */
export function scopePackageIds(scope: Scope, knownPackageIds: readonly number[]): readonly number[] {
  const product = requireProduct(scope.appId);
  switch (scope.kind) {
    case 'base':
      return product.basePackageIds;
    case 'dlc':
      return knownPackageIds.filter((id) => classifyPackage(product, id) === 'dlc');
    case 'app':
      return knownPackageIds;
  }
}

/** Human-readable scope statement. UI_SPEC.md requires the active scope to always be visible. */
export function describeScope(scope: Scope): string {
  const product = requireProduct(scope.appId);
  const channel =
    scope.saleType === 'Steam' ? 'Steam Store sales' : 'Retail / CD-key activations';
  switch (scope.kind) {
    case 'base':
      return `Base product only (DLC excluded) — Packages ${product.basePackageIds.join(', ')} — ${channel}`;
    case 'dlc':
      return `DLC / non-base packages under AppID ${product.appId} — ${channel}`;
    case 'app':
      return `All packages under AppID ${product.appId} (base + DLC) — ${channel}`;
  }
}
