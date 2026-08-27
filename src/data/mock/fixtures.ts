/**
 * Deterministic mock fixtures.
 *
 * PHASE 1 ONLY. These numbers are synthetic and must never be presented as GGG
 * actuals; the UI labels the data source everywhere it is shown. The generator is
 * seeded so every run, every process and every test observes identical rows.
 *
 * The shape mirrors `detailed_sales` exactly (docs/DATA_MODEL.md) so that swapping
 * in the BigQuery repository changes only the data source, never the domain logic.
 */
import { eachDate } from '@/domain/dates';
import { round, trunc } from '@/domain/numeric';
import { PRODUCT_CATALOG } from '@/domain/scope';
import type { AdditionalRevenueShareTier, DetailedSalesRow } from '@/domain/types';

export const MOCK_RANGE = { start: '2024-01-01', end: '2026-08-26' } as const;

/* ----------------------------------------------------------------- PRNG */

/** Mulberry32: small, fast, fully deterministic. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/* ------------------------------------------------------------- Geography */

interface CountryDefinition {
  readonly code: string;
  readonly name: string;
  readonly region: string;
  readonly currency: string;
  /** Base price in local minor units. */
  readonly basePriceMinor: number;
  /** Local minor units per USD, for converting the observed price to USD. */
  readonly minorPerUsd: number;
  readonly weight: number;
  readonly taxRate: number;
}

const COUNTRIES: readonly CountryDefinition[] = [
  { code: 'US', name: 'United States', region: 'North America', currency: 'USD', basePriceMinor: 7999, minorPerUsd: 100, weight: 0.26, taxRate: 0.06 },
  { code: 'JP', name: 'Japan', region: 'Asia', currency: 'JPY', basePriceMinor: 848000, minorPerUsd: 15200, weight: 0.19, taxRate: 0.1 },
  // DATA_MODEL.md: XC / "Unknown Country" is Steam China.
  { code: 'XC', name: 'Unknown Country', region: 'Asia', currency: 'CNY', basePriceMinor: 39800, minorPerUsd: 720, weight: 0.13, taxRate: 0.0 },
  { code: 'DE', name: 'Germany', region: 'Europe', currency: 'EUR', basePriceMinor: 7999, minorPerUsd: 92, weight: 0.07, taxRate: 0.19 },
  { code: 'GB', name: 'United Kingdom', region: 'Europe', currency: 'GBP', basePriceMinor: 6499, minorPerUsd: 79, weight: 0.05, taxRate: 0.2 },
  { code: 'FR', name: 'France', region: 'Europe', currency: 'EUR', basePriceMinor: 7999, minorPerUsd: 92, weight: 0.04, taxRate: 0.2 },
  { code: 'CA', name: 'Canada', region: 'North America', currency: 'CAD', basePriceMinor: 10499, minorPerUsd: 136, weight: 0.04, taxRate: 0.05 },
  { code: 'KR', name: 'Korea, Republic of', region: 'Asia', currency: 'KRW', basePriceMinor: 9900000, minorPerUsd: 133000, weight: 0.04, taxRate: 0.1 },
  { code: 'TW', name: 'Taiwan', region: 'Asia', currency: 'TWD', basePriceMinor: 219000, minorPerUsd: 3200, weight: 0.03, taxRate: 0.05 },
  { code: 'BR', name: 'Brazil', region: 'South America', currency: 'BRL', basePriceMinor: 19999, minorPerUsd: 545, weight: 0.05, taxRate: 0.0 },
  { code: 'AU', name: 'Australia', region: 'Oceania', currency: 'AUD', basePriceMinor: 11995, minorPerUsd: 152, weight: 0.04, taxRate: 0.1 },
  { code: 'PL', name: 'Poland', region: 'Europe', currency: 'PLN', basePriceMinor: 29900, minorPerUsd: 400, weight: 0.03, taxRate: 0.23 },
  { code: 'RU', name: 'Russian Federation', region: 'Europe', currency: 'RUB', basePriceMinor: 320000, minorPerUsd: 9000, weight: 0.03, taxRate: 0.0 },
];

/* -------------------------------------------------------------- Packages */

interface PackageDefinition {
  readonly appId: number;
  readonly appName: string;
  readonly packageId: number;
  readonly packageName: string;
  /** Relative daily unit volume. */
  readonly volume: number;
  /** Price relative to the base product price. */
  readonly priceFactor: number;
  readonly tier: AdditionalRevenueShareTier;
  /** Package is only sold within this window (inclusive). */
  readonly activeFrom?: string;
  readonly activeUntil?: string;
  /** Bundle id attached to rows for this package, when it participates in one. */
  readonly bundleId?: number;
  readonly bundleName?: string;
  readonly saleType?: 'Steam' | 'Retail';
}

const MZ = 1096900;
const MV = 363890;
const MZ_NAME = 'RPG Maker MZ';
const MV_NAME = 'RPG Maker MV';

const PACKAGES: readonly PackageDefinition[] = [
  // --- RPG Maker MZ: base Package family (METRICS.md) ---
  { appId: MZ, appName: MZ_NAME, packageId: 369820, packageName: 'RPG Maker MZ (legacy retail package)', volume: 0.6, priceFactor: 1, tier: 1, activeUntil: '2024-06-30' },
  { appId: MZ, appName: MZ_NAME, packageId: 481511, packageName: 'RPG Maker MZ (previous store package)', volume: 1.4, priceFactor: 1, tier: 1, activeUntil: '2025-02-28' },
  { appId: MZ, appName: MZ_NAME, packageId: 488238, packageName: 'RPG Maker MZ', volume: 9.0, priceFactor: 1, tier: 1, activeFrom: '2024-09-01' },
  // --- RPG Maker MZ: DLC ---
  { appId: MZ, appName: MZ_NAME, packageId: 512004, packageName: 'MZ - Medieval Fantasy Tile Pack', volume: 1.6, priceFactor: 0.22, tier: null },
  { appId: MZ, appName: MZ_NAME, packageId: 512188, packageName: 'MZ - Cyberpunk City Tiles', volume: 1.1, priceFactor: 0.25, tier: null },
  { appId: MZ, appName: MZ_NAME, packageId: 523771, packageName: 'MZ - Heroine Character Generator', volume: 0.9, priceFactor: 0.18, tier: 2 },
  { appId: MZ, appName: MZ_NAME, packageId: 541902, packageName: 'MZ - Orchestral Essentials Music Pack', volume: 0.7, priceFactor: 0.3, tier: null, activeFrom: '2024-05-15' },
  { appId: MZ, appName: MZ_NAME, packageId: 566310, packageName: 'MZ - Modern Interiors Tile Pack', volume: 0.5, priceFactor: 0.22, tier: null, activeFrom: '2025-03-10' },
  { appId: MZ, appName: MZ_NAME, packageId: 588417, packageName: 'MZ - Retro SFX Bundle Pack', volume: 0.4, priceFactor: 0.15, tier: null, activeFrom: '2025-11-01', bundleId: 33150, bundleName: 'RPG Maker MZ Audio Collection' },
  // --- RPG Maker MZ: Retail / CD-key activations (never Store revenue) ---
  { appId: MZ, appName: MZ_NAME, packageId: 488238, packageName: 'RPG Maker MZ', volume: 0.8, priceFactor: 1, tier: 1, saleType: 'Retail' },

  // --- RPG Maker MV: base Package family ---
  { appId: MV, appName: MV_NAME, packageId: 65464, packageName: 'RPG Maker MV (original package)', volume: 0.5, priceFactor: 0.9, tier: 1, activeUntil: '2025-05-31' },
  { appId: MV, appName: MV_NAME, packageId: 80322, packageName: 'RPG Maker MV', volume: 3.2, priceFactor: 0.9, tier: 1 },
  // METRICS.md: 88038 is the MV Bundle and is excluded from the base product.
  { appId: MV, appName: MV_NAME, packageId: 88038, packageName: 'RPG Maker MV Bundle', volume: 1.0, priceFactor: 1.6, tier: 1, bundleId: 12044, bundleName: 'RPG Maker MV Bundle' },
  // --- RPG Maker MV: DLC ---
  { appId: MV, appName: MV_NAME, packageId: 91250, packageName: 'MV - Medieval Fantasy Tile Pack', volume: 0.9, priceFactor: 0.22, tier: null },
  { appId: MV, appName: MV_NAME, packageId: 104881, packageName: 'MV - Cyberpunk City Tiles', volume: 0.6, priceFactor: 0.25, tier: null },
  { appId: MV, appName: MV_NAME, packageId: 118902, packageName: 'MV - Heroine Character Generator', volume: 0.5, priceFactor: 0.18, tier: 2 },
];

/* ---------------------------------------------------------- Sale windows */

interface SaleWindow {
  readonly start: string;
  readonly end: string;
  readonly discount: number;
}

/**
 * Seasonal discount windows. These describe the mock price curve only; the app
 * never labels them with an event name because no canonical event source exists
 * (docs/OPEN_QUESTIONS.md #4). The UI derives `Detected discounted period` from
 * the observed prices, exactly as it will against real data.
 */
const SALE_WINDOWS: readonly SaleWindow[] = [
  { start: '2024-01-01', end: '2024-01-04', discount: 0.6 },
  { start: '2024-03-14', end: '2024-03-21', discount: 0.5 },
  { start: '2024-06-27', end: '2024-07-11', discount: 0.65 },
  { start: '2024-09-05', end: '2024-09-09', discount: 0.4 },
  { start: '2024-11-27', end: '2024-12-04', discount: 0.6 },
  { start: '2024-12-19', end: '2025-01-05', discount: 0.7 },
  { start: '2025-03-13', end: '2025-03-20', discount: 0.5 },
  { start: '2025-06-26', end: '2025-07-10', discount: 0.65 },
  { start: '2025-09-29', end: '2025-10-06', discount: 0.45 },
  { start: '2025-11-26', end: '2025-12-02', discount: 0.6 },
  { start: '2025-12-18', end: '2026-01-05', discount: 0.7 },
  { start: '2026-03-12', end: '2026-03-19', discount: 0.5 },
  { start: '2026-06-25', end: '2026-07-09', discount: 0.65 },
  { start: '2026-08-13', end: '2026-08-20', discount: 0.45 },
];

function discountFor(date: string): number {
  for (const window of SALE_WINDOWS) {
    if (date >= window.start && date <= window.end) return window.discount;
  }
  return 0;
}

/* --------------------------------------------------------- Row generation */

function isActive(pkg: PackageDefinition, date: string): boolean {
  if (pkg.activeFrom && date < pkg.activeFrom) return false;
  if (pkg.activeUntil && date > pkg.activeUntil) return false;
  return true;
}

/** Weekend and long-tail decay shaping so the daily series is not flat noise. */
function demandShape(date: string, dayIndex: number): number {
  const weekday = (dayIndex + 1) % 7; // 2024-01-01 was a Monday.
  const weekendBoost = weekday === 5 || weekday === 6 ? 1.25 : 1;
  const decay = 1 / (1 + dayIndex / 2600);
  return weekendBoost * decay;
}

function generateRows(): DetailedSalesRow[] {
  const rows: DetailedSalesRow[] = [];
  const dates = eachDate(MOCK_RANGE);

  for (const [dayIndex, date] of dates.entries()) {
    const discount = discountFor(date);
    const shape = demandShape(date, dayIndex);
    // A discount lifts volume; the multiplier is a modelling choice for the mock
    // only and is never used as a causal claim anywhere in the app.
    const saleLift = discount > 0 ? 1 + discount * 9 : 1;

    for (const pkg of PACKAGES) {
      if (!isActive(pkg, date)) continue;
      const saleType = pkg.saleType ?? 'Steam';
      const isRetail = saleType === 'Retail';

      for (const country of COUNTRIES) {
        const random = createRandom(hashString(`${date}|${pkg.packageId}|${saleType}|${country.code}`));

        const expected = pkg.volume * country.weight * shape * (isRetail ? 0.35 : saleLift) * 26;
        const units = Math.floor(expected * (0.55 + random() * 0.9));
        if (units <= 0) continue;

        if (isRetail) {
          // Retail/CD-key activation rows carry activation counts, not Store money.
          rows.push({
            date,
            primary_appid: pkg.appId,
            app_name: pkg.appName,
            packageid: pkg.packageId,
            package_name: pkg.packageName,
            bundleid: null,
            bundle_name: null,
            line_item_type: 'Package',
            package_sale_type: 'Retail',
            country_code: country.code,
            country_name: country.name,
            region: country.region,
            platform: 'PC',
            gross_units_sold: 0,
            gross_units_returned: 0,
            net_units_sold: 0,
            gross_sales_usd: 0,
            gross_returns_usd: 0,
            net_tax_usd: 0,
            net_sales_usd: 0,
            revenue_share_usd: 0,
            additional_revenue_share_tier: null,
            base_price: null,
            sale_price: null,
            currency: null,
            total_discount_percentage: null,
            combined_discount_id: null,
            gross_units_activated: units,
            key_request_id: `KR-${pkg.appId}-${date.slice(0, 7)}`,
            territory_code_description: `${country.region} territory`,
          });
          continue;
        }

        const basePriceMinor = Math.round(country.basePriceMinor * pkg.priceFactor);
        const salePriceMinor = Math.round(basePriceMinor * (1 - discount));
        const unitPriceUsd = salePriceMinor / country.minorPerUsd;

        // Returns are a small fraction of units, always stored signed negative.
        const returnedUnits = random() < 0.42 ? -Math.max(1, Math.floor(units * (0.006 + random() * 0.03))) : 0;

        // Cents-level noise so the TRUNC rules in METRICS.md are actually exercised.
        const grossSales = round(units * unitPriceUsd * (0.995 + random() * 0.01), 4);
        const grossReturns = returnedUnits === 0 ? 0 : -round(-returnedUnits * unitPriceUsd * (0.99 + random() * 0.02), 4);
        const netRevenue = grossSales + grossReturns;
        const netTax = round(netRevenue * country.taxRate, 4);
        const netSales = round(netRevenue - netTax, 4);

        const tierRate = pkg.tier === 1 ? 0.05 : pkg.tier === 2 ? 0.1 : 0;
        const revenueShare = trunc(round(netSales, 3) * 0.7, 2) + round(netSales * tierRate, 2);

        const platformRoll = random();
        const platform = platformRoll < 0.86 ? 'Windows' : platformRoll < 0.96 ? 'macOS' : 'Linux';

        rows.push({
          date,
          primary_appid: pkg.appId,
          app_name: pkg.appName,
          packageid: pkg.packageId,
          package_name: pkg.packageName,
          bundleid: pkg.bundleId ?? null,
          bundle_name: pkg.bundleName ?? null,
          line_item_type: 'Package',
          package_sale_type: 'Steam',
          country_code: country.code,
          country_name: country.name,
          region: country.region,
          platform,
          gross_units_sold: units,
          gross_units_returned: returnedUnits,
          net_units_sold: units + returnedUnits,
          gross_sales_usd: grossSales,
          gross_returns_usd: grossReturns,
          net_tax_usd: netTax,
          net_sales_usd: netSales,
          revenue_share_usd: revenueShare,
          additional_revenue_share_tier: pkg.tier,
          base_price: basePriceMinor,
          sale_price: salePriceMinor,
          currency: country.currency,
          total_discount_percentage: discount === 0 ? 0 : Math.round(discount * 100),
          combined_discount_id: discount === 0 ? null : `disc-${date.slice(0, 7)}`,
          gross_units_activated: 0,
          key_request_id: null,
          territory_code_description: null,
        });
      }
    }
  }

  return rows;
}

let cache: DetailedSalesRow[] | null = null;

/** Lazily generated once per process. */
export function mockRows(): readonly DetailedSalesRow[] {
  cache ??= generateRows();
  return cache;
}

/** AppIDs present in the fixtures, intersected with the product catalogue. */
export function mockAppIds(): number[] {
  return PRODUCT_CATALOG.map((product) => product.appId);
}
