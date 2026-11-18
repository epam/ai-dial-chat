import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { KnipConfiguration, WorkspaceProjectConfig } from 'knip';

/*
 * Knip reachability analysis for the monorepo: unused files, exports, types,
 * enum members and dependencies. Advisory only — nothing in CI runs it.
 *
 *   npm run knip               comprehensive: production + tests and tooling
 *   npm run knip:production    production code only (`!`-suffixed patterns)
 *
 * Both scripts pass `tools/knip/drop-root-manifest-repeats.mjs` as a
 * preprocessor: the root manifest repeats every workspace's dependencies for
 * installation, and a root `ignoreDependencies` cannot drop those repeats
 * without also silencing the owning workspace.
 *
 * Never run `knip --fix`: an export the monorepo does not import may still be
 * public API of a published lib.
 */

const SOURCE_EXTENSIONS = '{js,jsx,mjs,cjs,ts,tsx,mts,cts}';

/* Folders beside `src/` that hold tests and tooling, never shipped code. */
const NON_PRODUCTION_FOLDERS = [
  '.storybook',
  'browser-tests',
  'e2e-fixtures',
  'tests',
];

/*
 * `project` for one app or lib. `src/**` with the `!` suffix is the
 * production scope; the `!…!` negations remove test helpers, fixtures and
 * stories from it and are ignored outside `--production`, so unused test
 * helpers still surface in the comprehensive run. The unsuffixed patterns
 * add config files and the non-production folders to the comprehensive scope
 * only. They must not overlap `src/**`: `--production` negates every
 * unsuffixed pattern, so a broad `**` glob would empty the production scope.
 */
const packageProject = (
  workspaceDir: string,
  extraNonProduction: string[] = [],
): string[] => [
  `*.${SOURCE_EXTENSIONS}`,
  ...NON_PRODUCTION_FOLDERS.filter((folder) =>
    existsSync(join(workspaceDir, folder)),
  ).map((folder) => `${folder}/**/*.${SOURCE_EXTENSIONS}`),
  `src/**/*.${SOURCE_EXTENSIONS}!`,
  '!src/**/tests/**!',
  '!src/**/test-utils/**!',
  '!src/**/stories/**!',
  '!src/**/*.stories.{ts,tsx}!',
  '!src/**/*.{spec,test}.{ts,tsx}!',
  '!src/test-setup.ts!',
  ...extraNonProduction.map((pattern) => `!${pattern}!`),
];

interface WorkspaceOverride {
  entry?: string[];
  /* Files under `src/` that only Nx tooling targets run. */
  nonProduction?: string[];
  ignoreUnresolved?: string[];
}

/*
 * Binaries that package scripts and Nx targets run from root devDependencies.
 * `--production` treats devDependencies as not installed and would list them
 * as unlisted. The `!` suffix limits each ignore to `--production`; a root
 * ignore applies to every workspace.
 */
const PRODUCTION_ONLY_IGNORED_BINARIES = [
  'nx!',
  'webpack-cli!',
  'vitest!',
  'cross-env!',
];

/*
 * Per-workspace additions to the defaults. The Nest apps build through
 * `NxAppWebpackPlugin`, which cannot be loaded outside an Nx task (it reads
 * the task's project-graph node), so the webpack plugin is disabled below and
 * their configs become plain entry files.
 */
const WORKSPACE_OVERRIDES: Record<string, WorkspaceOverride> = {
  'apps/chat-api': {
    entry: ['src/main.ts!', 'webpack.config.js', 'webpack.hmr.config.js'],
    nonProduction: ['src/openapi-spec.ts', 'src/managed-config-schema.ts'],
  },
  'apps/mcp-app-sandbox': {
    entry: ['src/main.ts!', 'webpack.config.js'],
  },
  'libs/chat-hooks': {
    entry: ['e2e-fixtures/*.mjs'],
  },
  'libs/celebrations': {
    entry: ['browser-tests/*.mjs'],
    /* Browser tests import scene modules through the Vite dev-server URL. */
    ignoreUnresolved: ['^/src/'],
  },
};

const toWorkspaceConfig = (dir: string): WorkspaceProjectConfig => {
  const { entry, nonProduction, ignoreUnresolved } =
    WORKSPACE_OVERRIDES[dir] ?? {};
  return {
    ...(entry && { entry }),
    project: packageProject(dir, nonProduction),
    ...(ignoreUnresolved && { ignoreUnresolved }),
  };
};

const packageWorkspaces = Object.fromEntries(
  ['apps', 'libs']
    .flatMap((parent) =>
      readdirSync(parent, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => `${parent}/${dirent.name}`),
    )
    .filter((dir) => existsSync(join(dir, 'package.json')))
    .map((dir) => [dir, toWorkspaceConfig(dir)]),
);

const config: KnipConfiguration = {
  webpack: false,
  ignoreFiles: ['openspec/**'],
  rules: {
    /*
     * This type lists optional peers that code imports. Libs mark peers
     * optional on purpose, so a host installs only the peers of the entry
     * points it uses (`.claude/rules/libs.md`).
     */
    optionalPeerDependencies: 'off',
  },
  workspaces: {
    '.': {
      /*
       * Root files are tooling only: no `!` suffix, so `--production`
       * leaves the root out.
       */
      entry: [
        'scripts/*.mjs',
        'tools/*.mjs',
        'tools/knip/*.mjs',
        'tools/**/*.d.mts',
        'tools/*-consumer-fixture/scripts/*.mjs',
        '.claude/skills/*/*.mjs',
        '.claude/skills/*/scripts/*.mjs',
      ],
      project: [`**/*.${SOURCE_EXTENSIONS}`],
      ignoreBinaries: PRODUCTION_ONLY_IGNORED_BINARIES,
    },
    ...packageWorkspaces,
  },
};

export default config;
