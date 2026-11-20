// ESLint for the code inside index.html / 3d.html (extracted to .check/ by tools/extract-scripts.mjs) and the Node tools.
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'vendor/**'] },
  js.configs.recommended,
  {
    files: ['.check/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-shadow-restricted-names': 'error',
      'no-implicit-globals': 'error',
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      eqeqeq: ['error', 'smart'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-self-compare': 'error',
      'no-unmodified-loop-condition': 'error',
      'no-unreachable-loop': 'error',
      'no-constant-binary-expression': 'error',
      'no-use-before-define': ['error', { functions: false, classes: true, variables: false }],
      'array-callback-return': 'error',
      'no-promise-executor-return': 'error',
      'no-empty': ['error', { allowEmptyCatch: true }],
      // parsers use `if(m=line.match(re))` on purpose: one regex per line shape
      'no-cond-assign': 'off',
    },
  },
  { files: ['.check/index.js', '.check/3d.js', 'core.mjs'], languageOptions: { sourceType: 'module' } },
  {
    files: ['core.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-undef': 'error',
      'no-cond-assign': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['server.js', 'tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.node } },
  },
  { files: ['server.js'], languageOptions: { sourceType: 'commonjs' } },
  // Tiny third-party embed loader: ES5-ish on purpose (var, no modules) so any host can include it.
  {
    files: ['embed.js'],
    languageOptions: { ecmaVersion: 2020, sourceType: 'script', globals: { ...globals.browser } },
    rules: {
      'no-var': 'off',
      'prefer-const': 'off',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
