import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * Financial safeguard: METRICS.md forbids ABS() in financial calculations, because
 * returns are stored signed negative and an absolute value silently turns a refund
 * into revenue. Math.abs is therefore banned across the codebase.
 */
const noMathAbs = {
  selector: "CallExpression[callee.object.name='Math'][callee.property.name='abs']",
  message: 'Math.abs() is banned here: returns are signed negative (see docs/METRICS.md).',
};

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'coverage/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-restricted-syntax': ['error', noMathAbs],
    },
  },
  {
    /*
     * The single exemption. src/domain/numeric.ts implements BigQuery's TRUNC and
     * ROUND semantics, where magnitude comparison is the primitive being built —
     * it performs no financial aggregation itself. Every caller stays under the ban.
     */
    files: ['src/domain/numeric.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
];

export default config;
