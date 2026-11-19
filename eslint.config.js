import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['node_modules/', 'dist/', 'site/', '.venv-docs/', 'docs/design/screens/'] },
  js.configs.recommended,
  {
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    files: ['tools/**/*.mjs', 'tests/**/*.{js,mjs}', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]
