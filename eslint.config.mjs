import nx from '@nx/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import tailwindcss from 'eslint-plugin-tailwindcss';
import testingLibrary from 'eslint-plugin-testing-library';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Every `type:ui` lib's package name, read from the Nx tags so new feature libs are covered.
const uiLibPackageNames = readdirSync(new URL('./libs', import.meta.url))
  .map((dir) => new URL(`./libs/${dir}/package.json`, import.meta.url))
  .filter((manifestUrl) => existsSync(manifestUrl))
  .map((manifestUrl) => JSON.parse(readFileSync(manifestUrl, 'utf8')))
  .filter((manifest) => manifest.nx?.tags?.includes('type:ui'))
  .map((manifest) => manifest.name);

const relativeImportExtensionPattern = {
  regex: '^\\.{1,2}/.+\\.(?:js|jsx|ts|tsx)$',
  message:
    'Omit JavaScript and TypeScript extensions from relative source imports.',
};

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/node_modules',
      '**/.nx',
    ],
  },
  {
    // `@nx/enforce-module-boundaries` is intended to police imports between Nx
    // project source code. Bundler/tooling configs that sit at a project root
    // (vite.config.ts, etc.) are workspace-level concerns that legitimately
    // reach across the source graph (e.g. a lib build importing the shared
    // Tailwind theme so its isolated build emits matching CSS). Scope
    // the rule to `**/src/**` so it governs source code only — instead of
    // adding per-path `allow` exceptions every time a build config needs to
    // reach a sibling. The rest of the lint rules below keep their broader
    // scope.
    //
    // Every project carries exactly one `type:*` tag (see docs/architecture.md
    // "Module boundary rules"). A kind that may import nothing lists only its
    // own tag, because Nx treats an empty `onlyDependOnLibsWithTags` as "any".
    // `type:hooks` -> `type:ui` and `type:ui` -> `type:hooks` are known debt.
    files: ['**/src/**/*.{ts,tsx,js,jsx,cts,mts,cjs,mjs}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error', 'info'] }],
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:shared',
                'type:ui',
                'type:hooks',
                'type:api-client',
              ],
            },
            {
              sourceTag: 'type:hooks',
              onlyDependOnLibsWithTags: [
                'type:shared',
                'type:ui',
                'type:api-client',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: [
                'type:shared',
                'type:ui',
                'type:hooks',
              ],
            },
            {
              sourceTag: 'type:shared',
              onlyDependOnLibsWithTags: ['type:shared'],
            },
            {
              sourceTag: 'type:api-client',
              onlyDependOnLibsWithTags: ['type:api-client'],
            },
            {
              sourceTag: 'type:backend',
              onlyDependOnLibsWithTags: ['type:backend'],
            },
            {
              sourceTag: 'type:fixture',
              onlyDependOnLibsWithTags: [
                'type:shared',
                'type:ui',
                'type:hooks',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      prettier,
      import: importPlugin,
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
      tailwindcss,
    },
    settings: {
      tailwindcss: {
        // Absolute: a relative path is resolved against the nearest
        // package.json of each linted file, and every app and lib has its own.
        cssConfigPath: fileURLToPath(
          new URL('./tools/tailwind/index.css', import.meta.url),
        ),
        // Replaces the plugin's default list, so the defaults are repeated;
        // `mergeClasses` (ui-kit) is how most class strings here are built.
        functions: [
          'mergeClasses',
          'classnames',
          'classNames',
          'clsx',
          'cn',
          'ctl',
          'cva',
          'tv',
          'tw',
          'twMerge',
          'twJoin',
        ],
      },
    },
    rules: {
      // Prettier rules
      'prettier/prettier': 'error',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/set-state-in-effect': 'off',
      'tailwindcss/no-contradicting-classname': 'error',
      'tailwindcss/enforces-canonical-classname': 'error',

      // Import rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          'newlines-between': 'never',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/no-duplicates': 'error',
      'import/no-unresolved': 'off', // TypeScript handles this
      'no-restricted-imports': [
        'error',
        { patterns: [relativeImportExtensionPattern] },
      ],

      // Accessibility rules
      'jsx-a11y/alt-text': 'warn',
      'jsx-a11y/anchor-has-content': 'warn',
      'jsx-a11y/anchor-is-valid': 'warn',
      'jsx-a11y/aria-props': 'warn',
      'jsx-a11y/aria-role': 'warn',
      'jsx-a11y/aria-unsupported-elements': 'warn',
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/heading-has-content': 'warn',
      'jsx-a11y/html-has-lang': 'warn',
      'jsx-a11y/iframe-has-title': 'warn',
      'jsx-a11y/img-redundant-alt': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',
      'jsx-a11y/label-has-associated-control': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/role-has-required-aria-props': 'warn',
      'jsx-a11y/role-supports-aria-props': 'warn',
      'jsx-a11y/scope': 'warn',
    },
  },
  {
    /*
     * Consumer fixtures install packed lib tarballs into their own
     * node_modules, so their imports resolve to no Nx project or npm node and
     * `@nx/enforce-module-boundaries` skips them. Like any external host, a
     * fixture must not reach for the generated API client directly. This block
     * must come after the general one above, which also sets this rule.
     */
    files: ['tools/*-consumer-fixture/src/**/*.{ts,tsx,js,jsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            relativeImportExtensionPattern,
            {
              group: [
                '@epam/ai-dial-chat-api-client',
                '@epam/ai-dial-chat-api-client/*',
              ],
              message:
                'Consumer fixtures are external hosts: use the published lib APIs, not the generated DIAL Chat API client.',
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * `chat-hooks` may take a feature lib's types, enums and pure functions to
     * build that lib's props, but never its hooks: it holds non-rendering
     * code only. Like the fixture block, this must follow the general block.
     */
    files: ['libs/chat-hooks/src/**/*.{ts,tsx}'],
    ignores: ['**/*.spec.*', '**/tests/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            relativeImportExtensionPattern,
            {
              group: uiLibPackageNames.flatMap((name) => [name, `${name}/*`]),
              importNamePattern: '^use[A-Z]',
              message:
                "chat-hooks may import a feature lib's types, enums and pure functions, not its hooks.",
            },
          ],
        },
      ],
    },
  },
  {
    /*
     * Among feature libs only `toolset-editor` imports `chat-hooks` (see
     * AGENTS.md "Library isolation"); any other feature lib takes behaviour
     * through props and callbacks instead.
     */
    files: ['libs/*/src/**/*.{ts,tsx}'],
    ignores: ['libs/chat-hooks/**', 'libs/toolset-editor/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            relativeImportExtensionPattern,
            {
              group: ['@epam/ai-dial-chat-hooks', '@epam/ai-dial-chat-hooks/*'],
              message:
                'Only toolset-editor among feature libs may import chat-hooks; take the behaviour through props or callbacks.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // React Testing Library rules apply only to spec files (this repo's
    // convention is co-located `*.spec.ts(x)`, never `*.test.ts(x)`).
    files: ['**/*.spec.ts', '**/*.spec.tsx'],
    plugins: {
      'testing-library': testingLibrary,
    },
    rules: {
      ...testingLibrary.configs['flat/react'].rules,
    },
  },
  prettierConfig,
];
