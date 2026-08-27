/**
 * Test-environment stub for the `server-only` package.
 *
 * The real package throws on import outside a React Server Component, which makes
 * `@/data` and `@/lib/pageContext` unimportable from a Node test even though both
 * are exactly the server-side modules a repository test needs to exercise.
 *
 * Aliasing it here does not weaken the guard: the guard that matters is the
 * `import 'server-only'` line in the source, and tests/architecture.test.ts
 * asserts that line is present by reading the file.
 */
export {};
