import { describe, expect, it } from 'vitest';
import {
  PRODUCT_CATALOG,
  classifyPackage,
  createScope,
  describeScope,
  findProduct,
  matchesScope,
  requireProduct,
  scopePackageIds,
} from '@/domain/scope';
import { computeFineGrainMetrics } from '@/domain/metrics';
import { row } from './factory';

const MZ = 1096900;
const MV = 363890;

describe('product catalogue', () => {
  it('encodes the documented base Package family for RPG Maker MZ', () => {
    const mz = requireProduct(MZ);
    expect(mz.basePackageIds).toEqual([481511, 369820, 488238]);
    expect(mz.currentBasePackageId).toBe(488238);
  });

  it('encodes the documented base Package family for RPG Maker MV', () => {
    const mv = requireProduct(MV);
    expect(mv.basePackageIds).toEqual([65464, 80322]);
    expect(mv.bundlePackageIds).toContain(88038);
    expect(mv.basePackageIds).not.toContain(88038);
  });

  it('throws rather than guessing for an unknown AppID', () => {
    expect(findProduct(999999)).toBeUndefined();
    expect(() => requireProduct(999999)).toThrow(/Unknown AppID/);
  });

  it('is not hard-coded to a single title', () => {
    expect(PRODUCT_CATALOG.length).toBeGreaterThan(1);
  });
});

describe('base-product scope', () => {
  const scope = createScope(MZ, 'base');

  it('accepts only the base Package family', () => {
    expect(matchesScope(row({ packageid: 488238 }), scope)).toBe(true);
    expect(matchesScope(row({ packageid: 481511 }), scope)).toBe(true);
    expect(matchesScope(row({ packageid: 369820 }), scope)).toBe(true);
  });

  it('rejects DLC packages that share the same primary_appid', () => {
    // The central safeguard: primary_appid alone must not produce base totals.
    expect(matchesScope(row({ packageid: 512004 }), scope)).toBe(false);
  });

  it('excludes the MV Bundle from the MV base product', () => {
    const mvScope = createScope(MV, 'base');
    expect(matchesScope(row({ primary_appid: MV, packageid: 80322 }), mvScope)).toBe(true);
    expect(matchesScope(row({ primary_appid: MV, packageid: 88038 }), mvScope)).toBe(false);
  });

  it('rejects Retail rows when the scope is Steam Store sales', () => {
    expect(matchesScope(row({ packageid: 488238, package_sale_type: 'Retail' }), scope)).toBe(false);
    const retailScope = createScope(MZ, 'base', 'Retail');
    expect(matchesScope(row({ packageid: 488238, package_sale_type: 'Retail' }), retailScope)).toBe(true);
    expect(matchesScope(row({ packageid: 488238, package_sale_type: 'Steam' }), retailScope)).toBe(false);
  });

  it('rejects rows belonging to a different AppID', () => {
    expect(matchesScope(row({ primary_appid: MV, packageid: 488238 }), scope)).toBe(false);
  });

  it('rejects non-Package line items', () => {
    expect(matchesScope(row({ packageid: 488238, line_item_type: 'Bundle' }), scope)).toBe(false);
  });

  it('changes the total: base scope is strictly smaller than app scope', () => {
    const rows = [
      row({ packageid: 488238, gross_sales_usd: 100, gross_units_sold: 10 }),
      row({ packageid: 512004, gross_sales_usd: 40, gross_units_sold: 8 }),
    ];
    const base = computeFineGrainMetrics(rows.filter((r) => matchesScope(r, scope)));
    const app = computeFineGrainMetrics(rows.filter((r) => matchesScope(r, createScope(MZ, 'app'))));
    expect(base.grossSales).toBe(100);
    expect(app.grossSales).toBe(140);
  });
});

describe('DLC scope', () => {
  const scope = createScope(MZ, 'dlc');

  it('accepts non-base packages under the parent App', () => {
    expect(matchesScope(row({ packageid: 512004 }), scope)).toBe(true);
    expect(matchesScope(row({ packageid: 488238 }), scope)).toBe(false);
  });

  it('classifies packages as base, bundle or DLC', () => {
    expect(classifyPackage(requireProduct(MZ), 488238)).toBe('base');
    expect(classifyPackage(requireProduct(MZ), 512004)).toBe('dlc');
    expect(classifyPackage(requireProduct(MV), 88038)).toBe('bundle');
    expect(classifyPackage(requireProduct(MV), 80322)).toBe('base');
  });

  it('resolves package ids for SQL parameters', () => {
    const known = [488238, 481511, 369820, 512004, 523771];
    expect(scopePackageIds(createScope(MZ, 'base'), known)).toEqual([481511, 369820, 488238]);
    expect(scopePackageIds(createScope(MZ, 'dlc'), known)).toEqual([512004, 523771]);
    expect(scopePackageIds(createScope(MZ, 'app'), known)).toEqual(known);
  });
});

describe('scope description', () => {
  it('always states the package family and the sales channel', () => {
    const text = describeScope(createScope(MZ, 'base'));
    expect(text).toContain('Base product only');
    expect(text).toContain('481511');
    expect(text).toContain('Steam Store sales');
  });

  it('labels the retail channel distinctly', () => {
    expect(describeScope(createScope(MZ, 'base', 'Retail'))).toContain('Retail / CD-key activations');
  });
});
