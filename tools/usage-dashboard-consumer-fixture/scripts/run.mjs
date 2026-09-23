#!/usr/bin/env node
/**
 * Proves `@epam/ai-dial-usage-dashboard`'s generated-BFF-client boundary two
 * ways:
 *
 * 1. **Static scan.** Its built `dist/**\/*.js` and `dist/**\/*.d.ts` contain
 *    no `@epam/ai-dial-chat-api-client` specifier and no re-exported
 *    generated DTO type name — checked directly against the emitted files,
 *    not inferred from source.
 * 2. **Real install.** The packed tarball installs into a dependency tree
 *    isolated from this checkout, with only the package's documented peers
 *    (`react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, and
 *    whatever *they* in turn require) — deliberately **not** the generated
 *    client — pinned against `package-lock.json` or packed from the local
 *    tree. A consumer entry that imports `./styles.css` and constructs both
 *    `UsageLimitCardGroup` and `ModelLimitsSection` from normalized fixture
 *    data must typecheck and bundle against that tree.
 *
 * See `createFixtureDir`'s doc comment in the imported harness for why a
 * fixture nested inside the checkout (even git-ignored) would silently let
 * an "uninstalled" peer resolve from the workspace root instead of failing
 * the way an external consumer's install actually would — this fixture
 * reuses that harness rather than reimplementing it, exactly as
 * `tools/reusable-workflows-consumer-fixture` does.
 *
 * Usage: node scripts/run.mjs
 * Set KEEP_FIXTURES=1 to skip cleanup and inspect the isolated fixture's
 * node_modules/typecheck/bundle output by hand.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bundleFixture,
  cleanupDir,
  createFixtureDependencyResolver,
  createFixtureDir,
  createTmpRoot,
  FIXTURE_PACKAGE_VERSION,
  formatExecError,
  npmInstallFixture,
  typecheckFixture,
} from '../../../libs/chat-hooks/e2e-fixtures/harness.mjs';
import { UI_KIT_EDITOR_PEERS } from '../../../libs/chat-hooks/e2e-fixtures/fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(fixtureRoot, '..', '..');
const ROOT_PACKAGE = '@epam/ai-dial-usage-dashboard';
const ROOT_PROJECT_ROOT = 'libs/usage-dashboard';

/*
 * `@epam/ai-dial-ui-kit`'s published root entry reaches its optional editor
 * stack by name even for a consumer that never touches an editor component —
 * a known kit-side declaration/runtime leak (issue #8719) that every fixture
 * in `libs/chat-hooks/e2e-fixtures` installing the kit already has to work
 * around by naming these three explicitly.
 */
const EXTRA_DIRECT_PEERS = [...UI_KIT_EDITOR_PEERS];
const keepFixtures = process.env.KEEP_FIXTURES === '1';

/* The two ways the generated client's DTOs are named. Any of these appearing in the emitted dist means the boundary leaked. */
const FORBIDDEN_SPECIFIERS = [
  '@epam/ai-dial-chat-api-client',
  'UserLimitStatsResponseDto',
  'DeploymentLimitsResponseDto',
  'LimitStatsDto',
  'DeploymentItemDto',
  'DeploymentItemDtoTypeEnum',
];

const listFiles = (root, relativeDir = '') =>
  readdirSync(path.join(root, relativeDir), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = path.posix.join(
        relativeDir.replace(/\\/g, '/'),
        entry.name,
      );
      return entry.isDirectory()
        ? listFiles(root, relativePath)
        : [relativePath];
    },
  );

let exitCode = 0;
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  exitCode = 1;
};

// ---------------------------------------------------------------------------
// 1. Static scan of the emitted dist/ output.
// ---------------------------------------------------------------------------

const distDir = path.join(workspaceRoot, ROOT_PROJECT_ROOT, 'dist');
if (!existsSync(distDir)) {
  console.error(
    `Build output not found at ${ROOT_PROJECT_ROOT}/dist. Run "npm exec nx build usage-dashboard" first.`,
  );
  process.exit(1);
}

console.info('Scanning emitted dist/ for a returning generated-client edge...');
const distFiles = listFiles(distDir).filter(
  (relativePath) =>
    relativePath.endsWith('.js') || relativePath.endsWith('.d.ts'),
);
for (const relativePath of distFiles) {
  const contents = readFileSync(path.join(distDir, relativePath), 'utf8');
  for (const specifier of FORBIDDEN_SPECIFIERS) {
    if (contents.includes(specifier)) {
      fail(
        `dist/${relativePath} contains "${specifier}" — the generated-client boundary has leaked into the emitted artifact.`,
      );
    }
  }
}
if (exitCode === 0) {
  console.info(
    `OK: none of ${distFiles.length} emitted files under dist/ reference the generated client or its DTOs.`,
  );
}

// ---------------------------------------------------------------------------
// 2. Isolated install, typecheck, and bundle.
// ---------------------------------------------------------------------------

const tmpRoot = createTmpRoot('usage-dashboard-consumer-fixture-');
const dir = createFixtureDir(tmpRoot, 'consumer');

try {
  console.info(
    'Resolving the full dependency + peer closure for @epam/ai-dial-usage-dashboard...',
  );
  const dependencyResolver = createFixtureDependencyResolver({
    workspaceRoot,
    tmpRoot,
    version: FIXTURE_PACKAGE_VERSION,
  });

  const workspaceLock = JSON.parse(
    readFileSync(path.join(workspaceRoot, 'package-lock.json'), 'utf8'),
  );
  const lockedVersion = (name) => {
    const version = workspaceLock.packages?.[`node_modules/${name}`]?.version;
    if (!version) {
      throw new Error(
        `package-lock.json has no exact root version for ${name}`,
      );
    }
    return version;
  };

  const dependencies = {
    react: lockedVersion('react'),
    'react-dom': lockedVersion('react-dom'),
    '@types/react': lockedVersion('@types/react'),
    ...dependencyResolver.resolvePeerClosure([
      ROOT_PACKAGE,
      ...EXTRA_DIRECT_PEERS,
    ]),
  };

  /*
   * Explicit assertion, not just an absent key: a peer closure that silently
   * stopped naming the root package would still pass every other check here,
   * since nothing in the entry file imports it either.
   *
   * The aggregate closure itself is not asserted against the generated
   * client here: `createFixtureDependencyResolver` was written for
   * `@epam/ai-dial-chat-hooks`'s own fixtures and unconditionally splices
   * that package's *own* workspace dependencies — which legitimately
   * include `@epam/ai-dial-chat-api-client`, its documented narrow
   * exception — into every closure it computes, regardless of the root
   * package under test. That is a property of the shared harness, not of
   * `@epam/ai-dial-usage-dashboard`'s own dependency graph, so the
   * meaningful assertion is on the installed package's own manifest below,
   * not on this aggregate object.
   */
  if (ROOT_PACKAGE in dependencies === false) {
    throw new Error(`${ROOT_PACKAGE} did not resolve into its own closure`);
  }

  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'usage-dashboard-consumer',
        private: true,
        type: 'module',
        dependencies,
      },
      null,
      2,
    ) + '\n',
  );

  console.info(
    `Packed workspace tarballs: ${dependencyResolver.getPackedWorkspacePeerNames().join(', ')}`,
  );
  console.info(
    'Installing the isolated fixture (no --legacy-peer-deps, no ancestor node_modules)...',
  );
  npmInstallFixture(dir);

  /*
   * The precise, harness-quirk-proof assertion: what the installed
   * `@epam/ai-dial-usage-dashboard` package itself declares as a
   * dependency — the manifest a real host's package manager actually reads
   * to decide what else to install. Whether an unrelated sibling in this
   * fixture's closure (e.g. `@epam/ai-dial-chat-hooks`, dragged in only by
   * the shared harness's own convenience defaults) happens to depend on
   * the generated client for its own documented reasons is not a claim this
   * fixture makes.
   */
  const installedManifestPath = path.join(
    dir,
    'node_modules',
    '@epam',
    'ai-dial-usage-dashboard',
    'package.json',
  );
  const installedManifest = JSON.parse(
    readFileSync(installedManifestPath, 'utf8'),
  );
  if ('@epam/ai-dial-chat-api-client' in (installedManifest.dependencies ?? {})) {
    fail(
      'The installed @epam/ai-dial-usage-dashboard package.json still declares @epam/ai-dial-chat-api-client as a dependency.',
    );
  }
  /*
   * The publish transform strips the "./dist/" prefix from every manifest
   * path so a package packed from inside `dist/` (as this one is) resolves
   * correctly once installed — the installed package has no `dist/`
   * subfolder at all; its build output sits at the package root, exactly
   * like a real npm-published package.
   */
  if (
    existsSync(
      path.join(
        dir,
        'node_modules',
        '@epam',
        'ai-dial-usage-dashboard',
        'index.js',
      ),
    ) === false
  ) {
    throw new Error(
      'Installed @epam/ai-dial-usage-dashboard package has no index.js at its root — the tarball did not pack its build output.',
    );
  }

  /*
   * Every field a UsageLimitCardData/ModelLimitRow/ModelLimitPeriodStatuses
   * consumer would already have normalized — no DTO, no sentinel, no raw
   * timestamp. `createElement` (not JSX) because the harness's
   * typecheck/bundle steps are wired to a plain `entry.ts`.
   */
  writeFileSync(
    path.join(dir, 'entry.ts'),
    `import { createElement } from 'react';
import '@epam/ai-dial-usage-dashboard/styles.css';
import {
  ModelLimitMetricKind,
  ModelLimitsSection,
  ModelLimitStatus,
  UsageLimitCardGroup,
  UsageLimitStatus,
} from '@epam/ai-dial-usage-dashboard';
import type {
  ModelLimitPeriodStatuses,
  ModelLimitRow,
  UsageLimitCardData,
} from '@epam/ai-dial-usage-dashboard';

const cards: UsageLimitCardData[] = [
  {
    title: 'Today',
    periodDescription: 'Today',
    used: 3.6,
    total: 4,
    usedLabel: '$3.60',
    totalLabel: '$4.00',
    remainingLabel: '$0.40',
    usedPercent: 90,
    status: UsageLimitStatus.RunningLow,
    progressAriaLabel: '$3.60 of $4.00, 90% used',
  },
];

const unavailableCell = { kind: ModelLimitMetricKind.Unavailable, ariaLabel: 'Not available' };

const rows: ModelLimitRow[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    day: { tokens: unavailableCell, cost: unavailableCell },
    week: { tokens: unavailableCell, cost: unavailableCell },
    month: { tokens: unavailableCell, cost: unavailableCell },
    status: ModelLimitStatus.Unavailable,
  },
];

const periodStatuses: ModelLimitPeriodStatuses = {
  day: { status: ModelLimitStatus.Unavailable },
  week: { status: ModelLimitStatus.Unavailable },
  month: { status: ModelLimitStatus.Unavailable },
};

export const CardsExample = () =>
  createElement(UsageLimitCardGroup, {
    cards,
    labels: {
      defaultBadgeLabel: 'Within limits',
      runningLowBadgeLabel: 'Running low',
      limitReachedBadgeLabel: 'Limit reached',
      usedOfTotalLabel: ({ total }: { total: string }) => \`of \${total}\`,
      remainingCaptionLabel: ({ remaining }: { remaining: string }) =>
        \`\${remaining} left\`,
      usedPercentLabel: ({ percent }: { percent: number }) => \`\${percent}%\`,
    },
  });

export const ModelLimitsExample = () =>
  createElement(ModelLimitsSection, {
    rows,
    labels: {
      headingLabel: 'Model tokens limits',
      itemColumnLabel: 'Item',
      dayColumnLabel: 'Today',
      weekColumnLabel: 'This week',
      monthColumnLabel: 'This month',
      statusColumnLabel: 'Status',
      tokensLabel: 'Tokens',
      costLabel: 'Cost',
      modelTypeLabel: 'Model',
      noLimitLabel: 'No limit',
      unavailableLabel: 'Not available',
      withinLimitsBadgeLabel: 'Within limits',
      runningLowBadgeLabel: 'Running low',
      limitReachedBadgeLabel: 'Limit reached',
      noLimitBadgeLabel: 'No limit',
      unavailableBadgeLabel: 'Not available',
      emptyStateLabel: 'No models to show yet.',
    },
    periodStatuses,
  });
`,
  );

  console.info('Typechecking the packed artifact...');
  const tsc = typecheckFixture(workspaceRoot, dir);
  if (!tsc.success) {
    fail(`tsc --noEmit failed:\n${tsc.output}`);
  } else {
    console.info(
      'OK: the packed artifact typechecks against normalized fixture data only — no DTO import required.',
    );
  }

  console.info('Bundling the packed artifact with Vite (library mode)...');
  const bundle = bundleFixture(workspaceRoot, dir);
  if (!bundle.success) {
    fail(`vite build failed:\n${bundle.output}`);
  } else {
    const outDir = path.dirname(bundle.bundlePath);
    const outputFiles = readdirSync(outDir);

    const cssFiles = outputFiles.filter((file) => file.endsWith('.css'));
    if (cssFiles.length === 0) {
      fail('The bundle emitted no stylesheet — ./styles.css did not reach the build.');
    }

    const bundledJs = outputFiles
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFileSync(path.join(outDir, file), 'utf-8'))
      .join('\n');
    for (const specifier of FORBIDDEN_SPECIFIERS) {
      if (bundledJs.includes(specifier)) {
        fail(
          `The bundled output contains "${specifier}" — a real consumer install still pulls in the generated client.`,
        );
      }
    }

    if (exitCode === 0) {
      console.info(
        'OK: the consumer bundles cards and the model table from normalized data, with the stylesheet reaching the build and no generated-client specifier anywhere in the output.',
      );
    }
  }
} catch (err) {
  fail(formatExecError(err));
} finally {
  if (!keepFixtures) {
    cleanupDir(tmpRoot);
  } else {
    console.info(`\nKEEP_FIXTURES=1 set — fixture left at: ${dir}`);
  }
}

process.exit(exitCode);
