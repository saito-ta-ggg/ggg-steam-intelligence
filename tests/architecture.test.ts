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

/*
 * The warehouse SQL rules — date partition filter, named parameters only, base
 * scope restricted to its Package family, no ABS(), no ROUND/FLOOR substituted for
 * TRUNC, Steam/Retail separation, read-only — are asserted against the built
 * queries in tests/bigquerySql.test.ts. They used to be checked here by parsing
 * exported SQL strings, which silently became vacuous once the queries turned into
 * builder functions: two assertions kept passing against zero parsed queries.
 * Checking the builders' output instead makes that failure mode impossible.
 */

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
