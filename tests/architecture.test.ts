/**
 * Architecture guards.
 *
 * CLAUDE.md states several rules that no unit test of a formula can catch: SQL
 * must not live in React components, BigQuery must stay server-side and
 * read-only, every detailed_sales query needs a date partition filter, and ABS()
 * must not appear in a financial calculation. These are enforced here by reading
 * the source tree, so a future change that breaks one fails the suite rather
 * than shipping.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

function walk(directory: string): string[] {
  const entries: string[] = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) entries.push(...walk(path));
    else if (/\.tsx?$/.test(name)) entries.push(path);
  }
  return entries;
}

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/**
 * Strips block and line comments. Several guards below search for a forbidden
 * token, and the comment explaining why it is forbidden must not trip them.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const ALL_SOURCES = walk(SRC);
const UI_SOURCES = ALL_SOURCES.filter(
  (path) => path.includes(`${join('src', 'app')}`) || path.includes(`${join('src', 'components')}`),
);
const DATA_SOURCES = ALL_SOURCES.filter((path) => path.includes(join('src', 'data')));
const relative = (path: string) => path.slice(ROOT.length + 1);

describe('SQL stays in the data layer', () => {
  it('finds UI files to check', () => {
    expect(UI_SOURCES.length).toBeGreaterThan(10);
  });

  it('has no SQL statement in any React component or page', () => {
    const sqlStatement = /\b(SELECT\s+[\s\S]{0,200}?\bFROM\b|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i;
    const offenders = UI_SOURCES.filter((path) => sqlStatement.test(read(path))).map(relative);
    expect(offenders).toEqual([]);
  });

  it('never names the warehouse table in a React component or page', () => {
    // src/domain/types.ts documents the table it mirrors, which is intended; the
    // rule being enforced is that no UI file reaches for the warehouse directly.
    const offenders = UI_SOURCES.filter((path) => stripComments(read(path)).includes('detailed_sales')).map(relative);
    expect(offenders).toEqual([]);
  });

  it('never imports a BigQuery client into a React component or page', () => {
    const offenders = UI_SOURCES.filter((path) => /@google-cloud\/bigquery/.test(read(path))).map(relative);
    expect(offenders).toEqual([]);
  });
});

describe('BigQuery stays server-side', () => {
  // Both modules also describe the guard in a doc comment, so the import itself is
  // matched against stripped source — otherwise the prose alone would satisfy the test.
  it('guards the data-layer entry point with server-only', () => {
    expect(stripComments(read(join(SRC, 'data', 'index.ts')))).toMatch(/^\s*import 'server-only';/m);
  });

  it('guards the page-context loader with server-only', () => {
    expect(stripComments(read(join(SRC, 'lib', 'pageContext.ts')))).toMatch(/^\s*import 'server-only';/m);
  });

  it('marks no data-layer file as a client component', () => {
    const offenders = DATA_SOURCES.filter((path) => /^['"]use client['"]/m.test(read(path))).map(relative);
    expect(offenders).toEqual([]);
  });

  it('never exposes a BigQuery setting through a NEXT_PUBLIC_ variable', () => {
    const offenders: string[] = [];
    for (const path of ALL_SOURCES) {
      for (const match of read(path).matchAll(/NEXT_PUBLIC_\w+/g)) {
        if (/BIGQUERY|GOOGLE|CREDENTIAL|PROJECT|DATASET|KEY/i.test(match[0])) offenders.push(`${relative(path)}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('keeps credentials out of the example environment file', () => {
    const example = read(join(ROOT, '.env.example'));
    expect(example).not.toMatch(/NEXT_PUBLIC_.*(BIGQUERY|GOOGLE|CREDENTIAL)/i);
    // Only commented-out placeholders may mention credentials.
    for (const line of example.split('\n')) {
      if (/CREDENTIALS|PROJECT_ID|DATASET/.test(line)) expect(line.trimStart().startsWith('#')).toBe(true);
    }
  });

  it('ignores environment files so a real one can never be committed', () => {
    const ignore = read(join(ROOT, '.gitignore'));
    expect(ignore).toContain('.env');
    expect(ignore).toContain('*.pem');
  });
});

describe('detailed_sales SQL obeys the warehouse rules', () => {
  const sqlModule = read(join(SRC, 'data', 'bigquery', 'sql.ts'));

  /** Each exported template literal, so every query is checked individually. */
  const queries = [...sqlModule.matchAll(/export const (\w+_SQL) = `([\s\S]*?)`;/g)].map((match) => ({
    name: match[1]!,
    body: match[2]!,
  }));

  it('exports queries to check', () => {
    expect(queries.length).toBeGreaterThan(4);
  });

  it('gives every query a date partition filter', () => {
    const offenders = queries
      .filter((query) => !/\bdate BETWEEN @startDate AND @endDate\b/.test(query.body) && !/\$\{SCOPE_PREDICATE\}/.test(query.body))
      .map((query) => query.name);
    expect(offenders).toEqual([]);
  });

  it('has a date partition filter in the shared scope predicate', () => {
    expect(sqlModule).toMatch(/SCOPE_PREDICATE = `[\s\S]*?date BETWEEN @startDate AND @endDate/);
  });

  it('uses named parameters and never interpolates a filter value', () => {
    // Only the table constant and the shared predicate may be interpolated.
    const allowed = new Set(['${TABLE}', '${SCOPE_PREDICATE}', '${PACKAGE_FILTER}']);
    const offenders: string[] = [];
    for (const query of queries) {
      for (const match of query.body.matchAll(/\$\{[^}]*\}/g)) {
        if (!allowed.has(match[0])) offenders.push(`${query.name}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never uses ABS() in a financial calculation', () => {
    // The header comment states the rule, so only executable SQL is inspected.
    expect(stripComments(sqlModule)).not.toMatch(/\bABS\s*\(/i);
  });

  it('never substitutes ROUND or FLOOR for the calendar-month TRUNC', () => {
    // ROUND is permitted only where METRICS.md prescribes it: ROUND(net, 3) inside
    // the basic 70% component, and the final ROUND to cents on the additional tier.
    const monthly = queries.find((query) => query.name === 'MONTHLY_SALES_SQL')!;
    expect(monthly.body).not.toMatch(/\bFLOOR\s*\(/i);
    expect(monthly.body).toContain('SUM(TRUNC(package_month_gross, 2))');
    expect(monthly.body).toContain('SUM(TRUNC(ROUND(package_month_net, 3) * 0.70, 2))');
  });

  it('separates Steam Store sales from Retail activations', () => {
    const dlc = queries.find((query) => query.name === 'DLC_PERFORMANCE_SQL')!;
    const retail = queries.find((query) => query.name === 'RETAIL_ACTIVATIONS_SQL')!;
    expect(dlc.body).toContain("package_sale_type = 'Steam'");
    expect(retail.body).toContain("package_sale_type = 'Retail'");
    // The retail query exposes activation counts only, never money.
    expect(retail.body).not.toMatch(/_usd/);
  });

  it('is read-only', () => {
    expect(stripComments(sqlModule)).not.toMatch(/\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|MERGE\s+INTO|CREATE\s+(TABLE|VIEW)|DROP\s+\w+|TRUNCATE\s+TABLE)\b/i);
  });
});

describe('financial safeguards in application code', () => {
  it('never calls Math.abs outside the numeric primitives module', () => {
    const offenders = ALL_SOURCES.filter(
      (path) => !path.endsWith(join('domain', 'numeric.ts')) && /Math\.abs\s*\(/.test(stripComments(read(path))),
    ).map(relative);
    expect(offenders).toEqual([]);
  });

  it('never hard-codes a blanket 0.7 revenue share outside the documented rule', () => {
    const metrics = read(join(SRC, 'domain', 'metrics.ts'));
    // The 70% factor must appear only inside the basic component, alongside TRUNC/ROUND.
    expect(metrics).toContain('truncToCents(round(acc.net, 3) * 0.7)');
    const offenders = ALL_SOURCES.filter(
      (path) => !path.endsWith(join('domain', 'metrics.ts')) && !path.includes(join('data', 'mock')) && /\*\s*0\.7\b/.test(read(path)),
    ).map(relative);
    expect(offenders).toEqual([]);
  });
});
