import playwrightPlugin from 'eslint-plugin-playwright';

import baseConfig from '../../eslint.config.mjs';

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
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
