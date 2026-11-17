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
  // index.html is a classic script on purpose (its functions are reachable from the console for testing)
  { files: ['.check/index.js'], rules: { 'no-implicit-globals': 'off' } },
  { files: ['.check/3d.js'], languageOptions: { sourceType: 'module' } },
  {
    files: ['server.js', 'tools/**/*.mjs', 'eslint.config.mjs'],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.node } },
  },
  { files: ['server.js'], languageOptions: { sourceType: 'commonjs' } },
];
