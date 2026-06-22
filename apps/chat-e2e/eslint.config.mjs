import baseConfig from '../../eslint.config.mjs';

import playwrightPlugin from 'eslint-plugin-playwright';

export default [
  ...baseConfig,
  {
    files: ['apps/chat-e2e/src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      playwright: playwrightPlugin,
    },
    settings: {
      playwright: {
        globalAliases: {
          test: [
            'base',
            'dialTest',
            'dialSharedWithMeTest',
            'dialAdminTest',
            'dialOverlayTest',
          ],
        },
      },
    },
    rules: {
      ...playwrightPlugin.configs.recommended.rules,
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-conditional-expect': 'off',
      'playwright/no-skipped-test': 'off',
      'playwright/expect-expect': 'off',
      //TODO: remove the rule when released https://github.com/mskelton/eslint-plugin-playwright/pull/464
      'playwright/missing-playwright-await': 'off',
      'playwright/consistent-spacing-between-blocks': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
