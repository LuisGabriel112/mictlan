import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '.npm-cache/**', '.claude/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/core/src/**/*.{js,mjs,cjs,ts,mts,cts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          globals: ['Date', 'setTimeout', 'setInterval', 'fetch', 'window', 'document'],
          checkGlobalObject: true,
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='Math'][computed=false][property.name='random']",
          message: 'Math.random is forbidden in core/src; use an injected seeded RNG.',
        },
        {
          selector: "MemberExpression[object.name='Math'][computed=true][property.value='random']",
          message: 'Math.random is forbidden in core/src; use an injected seeded RNG.',
        },
      ],
    },
  },
];
