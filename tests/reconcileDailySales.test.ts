/**
 * Warehouse reconciliation harness.
 *
 * Purpose: prove that a daily series taken straight out of BigQuery and the
 * daily series the app renders on the Overview timeline are the same numbers.
 *
 * It is env-gated because it needs an export from the warehouse, which this
 * repository deliberately cannot produce on its own in Phase 1 (BigQuery is not
 * connected — see src/data/bigquery/bigqueryRepository.ts). Without the export
 * the whole file is skipped, so `npm test` stays green offline and in CI.
 *
 * Usage:
 *   BQ_DAILY_CSV=/path/to/export.csv npm run reconcile
 *
 * Optional:
 *   BQ_APPID=1096900          AppID under reconciliation (default 1096900).
 *   BQ_SCOPE=base|app|dlc     Scope the export was taken with (default base).
 *   BQ_RANGE_TOTAL_GROSS=...  A separately queried range total, cross-checked
 *                             against the sum of the daily rows.
 *
 * The CSV must be the output of `buildDailySalesQuery` (src/data/bigquery/sql.ts)
 * with its header row intact, so the column names below are the query's aliases.
 *
 * Two kinds of check run:
 *
 *   1. Invariants on the export itself, straight from docs/METRICS.md and
 *      docs/DATA_MODEL.md. These hold for real warehouse data regardless of what
 *      the app does, so they fail hard: they catch a mis-scoped or mis-signed
 *      query before anyone compares it to a chart.
 *   2. A row-for-row diff against the configured repository. This only *asserts*
 *      when the repository is actually reading BigQuery. Under the Phase 1 mock
 *      the fixtures are synthetic (src/data/mock/fixtures.ts), so a mismatch is
 *      the expected result and is reported rather than failed — a green tick
 *      there would mean nothing.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getRepository } from '@/data';
import { daysBetweenInclusive } from '@/domain/dates';
import { formatUsd } from '@/domain/format';
import { createScope, describeScope } from '@/domain/scope';
import { resolveParams } from '@/lib/params';
import type { DateRange, ScopeKind } from '@/domain/types';

const CSV_PATH = process.env.BQ_DAILY_CSV;
const APP_ID = Number(process.env.BQ_APPID ?? '1096900');
const SCOPE_KIND = (process.env.BQ_SCOPE ?? 'base') as ScopeKind;

/** Half a displayed cent: the app rounds only for display, so this is the visible limit. */
const MONEY_TOLERANCE = 0.005;
/** BigQuery and JS sum in different orders; a float-noise difference is not a mismatch. */
const FLOAT_NOISE = 1e-6;

/**
 * `a` and `b` agree to within `tolerance`.
 *
 * Written as two bounded comparisons rather than an absolute difference on
 * purpose: Math.abs is banned across this codebase (eslint.config.mjs), because
 * an absolute value applied to a signed-negative return turns a refund into
 * revenue. Bounding the signed difference from both sides needs no exemption.
 */
function agrees(a: number, b: number, tolerance: number): boolean {
  const delta = a - b;
  return delta <= tolerance && -delta <= tolerance;
}

interface ExportedDay {
  readonly date: string;
  readonly grossSales: number;
  readonly grossUnits: number;
  readonly returnedUnitsSigned: number;
  readonly netUnits: number;
  readonly grossReturns: number | null;
  readonly netTax: number | null;
  readonly netSteamSales: number | null;
  readonly revenueShare: number | null;
  readonly returnRate: number | null;
}

/**
 * Minimal RFC 4180 reader: quoted fields with embedded commas and doubled quotes.
 * BigQuery exports money without thousands separators, but a hand-pasted CSV may
 * carry them, so numeric parsing strips them explicitly rather than silently
 * producing NaN.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function normaliseHeader(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function readNumber(raw: string | undefined, column: string, date: string): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim().replace(/,/g, '').replace(/^\$/, '');
  if (trimmed === '' || trimmed.toUpperCase() === 'NULL') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    throw new Error(`Column "${column}" on ${date} is not a number: "${raw}".`);
  }
  return value;
}

function requireNumber(raw: string | undefined, column: string, date: string): number {
  const value = readNumber(raw, column, date);
  if (value === null) {
    throw new Error(`Column "${column}" is required but empty on ${date}.`);
  }
  return value;
}

function loadExport(path: string): ExportedDay[] {
  const rows = parseCsv(readFileSync(path, 'utf8'));
  const header = rows[0];
  if (!header) throw new Error(`${path} is empty.`);

  const index = new Map<string, number>();
  header.forEach((name, position) => index.set(normaliseHeader(name), position));

  for (const required of ['date', 'grosssales', 'grossunits', 'netunits']) {
    if (!index.has(required)) {
      throw new Error(
        `${path} is missing the "${required}" column. Export the output of buildDailySalesQuery with its header row.`,
      );
    }
  }

  const at = (row: string[], key: string): string | undefined => {
    const position = index.get(key);
    return position === undefined ? undefined : row[position];
  };

  return rows.slice(1).map((row) => {
    // BigQuery renders DATE as YYYY-MM-DD; a spreadsheet round-trip may add a time part.
    const date = (at(row, 'date') ?? '').trim().slice(0, 10);
    return {
      date,
      grossSales: requireNumber(at(row, 'grosssales'), 'gross_sales', date),
      grossUnits: requireNumber(at(row, 'grossunits'), 'gross_units', date),
      returnedUnitsSigned: readNumber(at(row, 'returnedunitssigned'), 'returned_units_signed', date) ?? 0,
      netUnits: requireNumber(at(row, 'netunits'), 'net_units', date),
      grossReturns: readNumber(at(row, 'grossreturns'), 'gross_returns', date),
      netTax: readNumber(at(row, 'nettax'), 'net_tax', date),
      netSteamSales: readNumber(at(row, 'netsteamsales'), 'net_steam_sales', date),
      revenueShare: readNumber(at(row, 'revenueshare'), 'revenue_share', date),
      returnRate: readNumber(at(row, 'returnrate'), 'return_rate', date),
    };
  });
}

// `describe.skipIf` still evaluates the suite body at collection time, so the
// export is loaded conditionally: without BQ_DAILY_CSV nothing is read and every
// test below is skipped.
const days = CSV_PATH ? loadExport(CSV_PATH) : [];

describe.skipIf(!CSV_PATH)('BigQuery daily series reconciliation', () => {
  const exportRange: DateRange = days.length
    ? {
        start: days.reduce((earliest, day) => (day.date < earliest ? day.date : earliest), days[0]!.date),
        end: days.reduce((latest, day) => (day.date > latest ? day.date : latest), days[0]!.date),
      }
    : { start: '1970-01-01', end: '1970-01-01' };
  const scope = createScope(APP_ID, SCOPE_KIND);

  describe('export integrity (docs/METRICS.md, docs/DATA_MODEL.md)', () => {
    it('carries at least one row', () => {
      expect(days.length).toBeGreaterThan(0);
    });

    it('has unique, ascending ISO dates', () => {
      const dates = days.map((day) => day.date);
      expect(dates).toEqual([...new Set(dates)]);
      expect(dates).toEqual([...dates].sort());
      for (const date of dates) expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('stores returned units as signed negative values', () => {
      const positive = days.filter((day) => day.returnedUnitsSigned > 0);
      expect(
        positive.map((day) => `${day.date}: ${day.returnedUnitsSigned}`),
        'returned_units_signed must never be positive — a positive value means ABS() or a sign flip entered the query',
      ).toEqual([]);
    });

    it('stores gross returns as signed negative values', () => {
      const positive = days.filter((day) => day.grossReturns !== null && day.grossReturns > 0);
      expect(positive.map((day) => `${day.date}: ${day.grossReturns}`)).toEqual([]);
    });

    it('satisfies net units = gross units + returned units (signed)', () => {
      const broken = days
        .filter((day) => day.netUnits !== day.grossUnits + day.returnedUnitsSigned)
        .map((day) => `${day.date}: ${day.grossUnits} + ${day.returnedUnitsSigned} != ${day.netUnits}`);
      expect(broken).toEqual([]);
    });

    it('reports a return rate consistent with its unit columns', () => {
      const broken = days
        .filter((day) => day.returnRate !== null && day.grossUnits !== 0)
        .filter((day) => !agrees(day.returnRate!, -day.returnedUnitsSigned / day.grossUnits, FLOAT_NOISE))
        .map((day) => `${day.date}: reported ${day.returnRate}`);
      expect(broken).toEqual([]);
    });

    it('agrees with a separately queried range total when one is supplied', () => {
      const supplied = process.env.BQ_RANGE_TOTAL_GROSS;
      if (!supplied) return;
      // Fine-grain rule: a daily series sums raw, so the sum of days is the range total.
      const summed = days.reduce((total, day) => total + day.grossSales, 0);
      expect(
        agrees(summed, Number(supplied), MONEY_TOLERANCE),
        `daily rows sum to ${summed}, supplied range total is ${supplied}`,
      ).toBe(true);
    });
  });

  describe('comparison against the configured repository', () => {
    it('matches the daily series the timeline renders', async () => {
      const repository = getRepository();
      const freshness = await repository.getFreshness();
      const bounds: DateRange = { start: freshness.earliestDate!, end: freshness.latestDate! };
      const uiRange = resolveParams({}, bounds).range;
      const app = await repository.getDailySales(scope, exportRange);
      const appByDate = new Map(app.map((point) => [point.date, point]));

      const mismatches: string[] = [];
      const missingInApp: string[] = [];
      // Signed drift in each direction, which says more than a single magnitude:
      // a series that is uniformly high is a scope or channel problem, while drift
      // in both directions points at the date window.
      let largestOver = 0;
      let largestUnder = 0;

      for (const day of days) {
        const point = appByDate.get(day.date);
        if (!point) {
          missingInApp.push(day.date);
          continue;
        }
        const delta = point.grossSales - day.grossSales;
        if (delta > largestOver) largestOver = delta;
        if (delta < largestUnder) largestUnder = delta;
        if (!agrees(point.grossSales, day.grossSales, MONEY_TOLERANCE) || point.grossUnits !== day.grossUnits) {
          mismatches.push(
            `${day.date}  warehouse ${formatUsd(day.grossSales)} / ${day.grossUnits}u  app ${formatUsd(point.grossSales)} / ${point.grossUnits}u  Δ ${delta.toFixed(4)}`,
          );
        }
      }
      const missingInExport = app.map((point) => point.date).filter((date) => !days.some((day) => day.date === date));

      const report = [
        `data source          ${repository.source}`,
        `scope                ${describeScope(scope)}`,
        `export range         ${exportRange.start} – ${exportRange.end} (${days.length} rows, ${daysBetweenInclusive(exportRange.start, exportRange.end)} calendar days)`,
        `warehouse bounds     ${bounds.start} – ${bounds.end}`,
        `default UI range     ${uiRange.start} – ${uiRange.end}`,
        `range agreement      ${uiRange.start === exportRange.start && uiRange.end === exportRange.end ? 'same' : 'DIFFERENT — the timeline is showing another window, so any diff below is a range difference first'}`,
        `days compared        ${days.length - missingInApp.length}`,
        `missing in app       ${missingInApp.length ? missingInApp.join(', ') : 'none'}`,
        `missing in export    ${missingInExport.length ? missingInExport.join(', ') : 'none'}`,
        `largest Δ gross      app high by ${largestOver.toFixed(6)}, app low by ${(-largestUnder).toFixed(6)}`,
        `mismatched days      ${mismatches.length}`,
        ...mismatches.slice(0, 20).map((line) => `  ${line}`),
        mismatches.length > 20 ? `  … ${mismatches.length - 20} more` : '',
      ]
        .filter(Boolean)
        .join('\n');
      console.log(`\n${report}\n`);

      if (repository.source !== 'bigquery') {
        // Phase 1: the app is on synthetic fixtures. Asserting equality here would
        // either fail meaninglessly or, worse, pass and imply the mock is actuals.
        console.log(
          'Repository source is "mock", so this comparison is informational only: the fixtures are synthetic and are not GGG actuals. Set DATA_SOURCE=bigquery to make this an assertion.',
        );
        return;
      }

      expect(missingInApp).toEqual([]);
      expect(missingInExport).toEqual([]);
      expect(mismatches).toEqual([]);
    });
  });
});
