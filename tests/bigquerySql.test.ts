/**
 * Regression tests for the Phase 2 query builders.
 *
 * Each block here corresponds to a defect found in Merge review:
 *   1. base scope aggregated on primary_appid alone, because the package filter
 *      was a separate exported string that no query remembered to append;
 *   2. the DLC query returned base packages, so a base product could be counted
 *      as DLC;
 *   3. the pricing query took base_price/sale_price with ANY_VALUE across all
 *      countries, comparing different currencies' minor units.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRICING_REFERENCE_MARKET,
  SCOPED_QUERY_BUILDERS,
  buildDlcPerformanceQuery,
  buildFreshnessQuery,
  buildPackagePerformanceQuery,
  buildRetailActivationsQuery,
} from '@/data/bigquery/sql';
import { createScope, requireProduct } from '@/domain/scope';
import type { DateRange } from '@/domain/types';

const MZ = 1096900;
const MV = 363890;
const RANGE: DateRange = { start: '2025-04-01', end: '2025-06-30' };
const SQL_SOURCE = readFileSync(join(__dirname, '..', 'src', 'data', 'bigquery', 'sql.ts'), 'utf8');

const scopedBuilders = Object.entries(SCOPED_QUERY_BUILDERS);

describe('1. base scope is always restricted to the base Package family', () => {
  it('covers every scoped builder', () => {
    expect(scopedBuilders.length).toBeGreaterThanOrEqual(5);
  });

  it.each(scopedBuilders)('%s filters a base scope on packageid', (_name, build) => {
    const { sql, params } = build(createScope(MZ, 'base'), RANGE);
    expect(sql).toContain('packageid IN UNNEST(@basePackageIds)');
    expect(params.basePackageIds).toEqual(requireProduct(MZ).basePackageIds);
  });

  it.each(scopedBuilders)('%s never relies on primary_appid alone for a base scope', (_name, build) => {
    const { sql } = build(createScope(MZ, 'base'), RANGE);
    // The AppID predicate may be present as a partition/cluster hint, but it must
    // never be the only thing narrowing the base product.
    expect(sql).toContain('primary_appid = @primaryAppId');
    expect(sql).toMatch(/packageid (IN|NOT IN) UNNEST/);
  });

  it.each(scopedBuilders)('%s carries a date partition filter', (_name, build) => {
    const { sql, params } = build(createScope(MZ, 'base'), RANGE);
    expect(sql).toContain('date BETWEEN @startDate AND @endDate');
    expect(params.startDate).toBe(RANGE.start);
    expect(params.endDate).toBe(RANGE.end);
  });

  it.each(scopedBuilders)('%s parameterises the sale channel', (_name, build) => {
    const steam = build(createScope(MZ, 'base', 'Steam'), RANGE);
    const retail = build(createScope(MZ, 'base', 'Retail'), RANGE);
    expect(steam.sql).toContain('package_sale_type = @packageSaleType');
    expect(steam.params.packageSaleType).toBe('Steam');
    expect(retail.params.packageSaleType).toBe('Retail');
  });

  it.each(scopedBuilders)('%s excludes base and bundle packages for a DLC scope', (_name, build) => {
    const { sql, params } = build(createScope(MV, 'dlc'), RANGE);
    const product = requireProduct(MV);
    expect(sql).toContain('packageid NOT IN UNNEST(@nonDlcPackageIds)');
    expect(params.nonDlcPackageIds).toEqual([...product.basePackageIds, ...(product.bundlePackageIds ?? [])]);
    // 88038 is the MV Bundle and must not be reachable through a DLC scope.
    expect(params.nonDlcPackageIds).toContain(88038);
  });

  it.each(scopedBuilders)('%s applies no package filter only for an explicit app scope', (_name, build) => {
    const { sql, params } = build(createScope(MZ, 'app'), RANGE);
    expect(sql).not.toMatch(/packageid (IN|NOT IN) UNNEST/);
    expect(params.basePackageIds).toBeUndefined();
  });

  it('uses the base Package family of the requested product, not a hard-coded one', () => {
    const mz = SCOPED_QUERY_BUILDERS.buildDailySalesQuery(createScope(MZ, 'base'), RANGE);
    const mv = SCOPED_QUERY_BUILDERS.buildDailySalesQuery(createScope(MV, 'base'), RANGE);
    expect(mz.params.basePackageIds).toEqual([481511, 369820, 488238]);
    expect(mv.params.basePackageIds).toEqual([65464, 80322]);
  });

  it('rejects an unregistered AppID rather than falling back to primary_appid', () => {
    expect(() => SCOPED_QUERY_BUILDERS.buildDailySalesQuery({ appId: 999999, kind: 'base', saleType: 'Steam' }, RANGE)).toThrow(
      /Unknown AppID/,
    );
  });

  it('registers every scope-taking builder, so a new one cannot skip these checks', () => {
    const declared = [...SQL_SOURCE.matchAll(/export function (build\w+Query)\(scope: Scope/g)].map((match) => match[1]!);
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.sort()).toEqual(Object.keys(SCOPED_QUERY_BUILDERS).sort());
  });

  it('no longer exports a detachable scope predicate that a query could forget', () => {
    // The original defect: SCOPE_PREDICATE and PACKAGE_FILTER were separate exported
    // strings, and every query used the first without the second.
    expect(SQL_SOURCE).not.toMatch(/export const (SCOPE_PREDICATE|PACKAGE_FILTER)\b/);
  });
});

describe('2. the DLC query never returns a base or bundle package', () => {
  it('excludes the base Package family', () => {
    const { sql, params } = buildDlcPerformanceQuery(MZ, RANGE);
    expect(sql).toContain('packageid NOT IN UNNEST(@nonDlcPackageIds)');
    for (const packageId of requireProduct(MZ).basePackageIds) {
      expect(params.nonDlcPackageIds).toContain(packageId);
    }
  });

  it('excludes bundle packages as well', () => {
    const { params } = buildDlcPerformanceQuery(MV, RANGE);
    expect(params.nonDlcPackageIds).toContain(88038);
    expect(params.nonDlcPackageIds).toContain(65464);
    expect(params.nonDlcPackageIds).toContain(80322);
  });

  it('restricts itself to Steam Store sales', () => {
    expect(buildDlcPerformanceQuery(MZ, RANGE).sql).toContain("package_sale_type = 'Steam'");
  });

  it('offers the all-packages query under a name that cannot be read as a DLC list', () => {
    const { sql, params } = buildPackagePerformanceQuery(MZ, RANGE);
    expect(sql).not.toMatch(/NOT IN UNNEST/);
    expect(params.nonDlcPackageIds).toBeUndefined();
    expect(buildPackagePerformanceQuery.name.toLowerCase()).not.toContain('dlc');
  });

  it('carries a date partition filter on every AppID-level query', () => {
    for (const built of [
      buildDlcPerformanceQuery(MZ, RANGE),
      buildPackagePerformanceQuery(MZ, RANGE),
      buildRetailActivationsQuery(MZ, RANGE),
      buildFreshnessQuery(RANGE),
    ]) {
      expect(built.sql).toContain('date BETWEEN @startDate AND @endDate');
    }
  });
});

describe('3. pricing never mixes currencies across markets', () => {
  const { sql, params } = SCOPED_QUERY_BUILDERS.buildPricingTimelineQuery(createScope(MZ, 'base'), RANGE);

  it('pins the price observation to the reference market', () => {
    expect(sql).toContain('country_code = @pricingCountryCode');
    expect(sql).toContain('currency = @pricingCurrency');
    expect(params.pricingCountryCode).toBe(PRICING_REFERENCE_MARKET.countryCode);
    expect(params.pricingCurrency).toBe(PRICING_REFERENCE_MARKET.currency);
  });

  it('uses US / USD as the Phase 1 reference market', () => {
    expect(PRICING_REFERENCE_MARKET).toEqual({ countryCode: 'US', currency: 'USD' });
  });

  it('never takes a price field with ANY_VALUE across countries', () => {
    // The original defect: ANY_VALUE(base_price) could pair a JPY base price with a
    // USD sale price and yield a meaningless effective discount.
    for (const field of ['base_price', 'sale_price', 'currency', 'total_discount_percentage']) {
      expect(sql).not.toContain(`ANY_VALUE(${field})`);
    }
  });

  it('computes the effective discount only when base_price > 0', () => {
    expect(sql).toContain('reference_price.base_price > 0');
  });

  it('keeps unit and USD money columns across the whole scope, not just the reference market', () => {
    // Those are USD figures and are correct summed worldwide; only price is pinned.
    expect(sql).toContain('SUM(gross_sales_usd)');
    expect(sql).toContain('SUM(gross_units_sold)');
    expect(sql).not.toMatch(/IF\(\s*country_code = @pricingCountryCode[^)]*gross_sales_usd/);
  });
});

describe('cross-cutting SQL rules', () => {
  const allQueries = [
    ...scopedBuilders.map(([name, build]) => ({ name, sql: build(createScope(MZ, 'base'), RANGE).sql })),
    { name: 'buildDlcPerformanceQuery', sql: buildDlcPerformanceQuery(MZ, RANGE).sql },
    { name: 'buildPackagePerformanceQuery', sql: buildPackagePerformanceQuery(MZ, RANGE).sql },
    { name: 'buildRetailActivationsQuery', sql: buildRetailActivationsQuery(MZ, RANGE).sql },
    { name: 'buildFreshnessQuery', sql: buildFreshnessQuery(RANGE).sql },
  ];

  it('never interpolates a value into SQL — only the table constant', () => {
    for (const query of allQueries) {
      // Any remaining ${...} would be a build-time interpolation of a filter value.
      expect(query.sql, query.name).not.toMatch(/\$\{/);
      expect(query.sql, query.name).toContain('`ggg-dashboard-494707.sales_steam.detailed_sales`');
    }
  });

  it('never uses ABS() anywhere', () => {
    for (const query of allQueries) expect(query.sql, query.name).not.toMatch(/\bABS\s*\(/i);
  });

  it('is read-only', () => {
    for (const query of allQueries) {
      expect(query.sql, query.name).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|MERGE\s+INTO|CREATE\s+(TABLE|VIEW)|DROP\s+\w+)\b/i);
    }
  });

  it('keeps the calendar-month TRUNC rule intact', () => {
    const monthly = SCOPED_QUERY_BUILDERS.buildMonthlySalesQuery(createScope(MZ, 'base'), RANGE).sql;
    expect(monthly).toContain('SUM(TRUNC(package_month_gross, 2))');
    expect(monthly).toContain('SUM(TRUNC(ROUND(package_month_net, 3) * 0.70, 2))');
    expect(monthly).not.toMatch(/\bFLOOR\s*\(/i);
  });
});
