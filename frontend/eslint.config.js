// @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  ...tanstackConfig,
  {
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'tailwind.config.js',
      'postcss.config.js',
      'dev-dist/**',
      'src/types/api.generated.ts',
    ],
  },
  {
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'no-shadow': 'off',
    },
  },
]
