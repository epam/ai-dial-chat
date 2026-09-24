#!/usr/bin/env node
/**
 * Proves `@epam/ai-dial-skills`'s and `@epam/ai-dial-prompts`'s published
 * package boundaries against an install with an **explicit, fully resolved
 * dependency tree** — every workspace-sibling dependency and every required
 * peer (`react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`, and
 * whatever *they* in turn require) is either packed from this checkout or
 * pinned to an exact `package-lock.json` version and handed to one real
 * `npm install`. Nothing resolves through this repo's own `node_modules` —
 * see `createFixtureDir`'s doc comment in the imported harness for why a
 * fixture nested inside the checkout (even git-ignored) would silently let
 * an "uninstalled" peer resolve from the workspace root instead of failing
 * the way an external consumer's install actually would.
 *
 * Reuses `libs/chat-hooks/e2e-fixtures/harness.mjs` rather than
 * reimplementing it: that module already solves exactly this problem
 * (isolated temp-dir fixtures, packed-tarball peer closures pinned against
 * the lockfile, `tsc`/Vite runs against the installed tree) for
 * `@epam/ai-dial-chat-hooks`'s own packed-consumer suite. `resolvePeerClosure`
 * is generic over its `directPeers` argument, so passing both
 * `@epam/ai-dial-skills` and `@epam/ai-dial-prompts` themselves packs and
 * resolves their entire dependency graph in one call — including each
 * other's shared workspace siblings (`@epam/ai-dial-catalog`,
 * `@epam/ai-dial-publish-panel`, `@epam/ai-dial-conversation-input`,
 * `@epam/ai-dial-attachment-input`) and every peer those siblings themselves
 * require (`@epam/ai-dial-chat-shared`'s own required peers
 * `@epam/ai-dial-react-file-manager`/`ag-grid-community` included).
 *
 * What this replaces: an earlier version of this fixture packed only the two
 * root packages plus their workspace-lib closure into its own `node_modules`
 * (mirroring `tools/attachment-canvas-consumer-fixture`) and left every
 * *peer* (`react`, `@epam/ai-dial-chat-shared`, `@epam/ai-dial-ui-kit`) to
 * resolve by plain ancestor `node_modules` lookup up to the workspace root.
 * That made a passing result compatible with either a genuinely resolvable
 * peer set or one that only happened to work because the workspace root
 * already had everything installed for `apps/chat` — it did not prove a real
 * external consumer's install would succeed.
 *
 * Usage: node scripts/run.mjs
 * Set KEEP_FIXTURES=1 to skip cleanup and inspect the isolated fixture's
 * node_modules/typecheck/bundle output by hand.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
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
const ROOT_PACKAGES = ['@epam/ai-dial-skills', '@epam/ai-dial-prompts'];
/*
 * `@epam/ai-dial-ui-kit`'s published root entry reaches its optional editor
 * stack by name even for a consumer that never touches an editor component —
 * a known kit-side declaration/runtime leak (issue #8719) that every fixture
 * in `libs/chat-hooks/e2e-fixtures` installing the kit already has to work
 * around by naming these three explicitly; reusing that same constant here
 * keeps the two suites from silently drifting on the workaround.
 */
const EXTRA_DIRECT_PEERS = [...UI_KIT_EDITOR_PEERS];
const ROOT_PROJECT_ROOTS = ['libs/skills', 'libs/prompts'];
const keepFixtures = process.env.KEEP_FIXTURES === '1';

for (const projectRoot of ROOT_PROJECT_ROOTS) {
  if (!existsSync(path.join(workspaceRoot, projectRoot, 'dist'))) {
    console.error(
      `Build output not found at ${projectRoot}/dist. Run "npm exec nx build ${ROOT_PACKAGES.join(' ')}" first.`,
    );
    process.exit(1);
  }
}

const workspaceLock = JSON.parse(
  readFileSync(path.join(workspaceRoot, 'package-lock.json'), 'utf8'),
);
const lockedVersion = (name) => {
  const version = workspaceLock.packages?.[`node_modules/${name}`]?.version;
  if (!version) {
    throw new Error(`package-lock.json has no exact root version for ${name}`);
  }
  return version;
};

const tmpRoot = createTmpRoot('reusable-workflows-consumer-fixture-');
const dir = createFixtureDir(tmpRoot, 'consumer');

let exitCode = 0;
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  exitCode = 1;
};

try {
  console.info(
    'Resolving the full dependency + peer closure for @epam/ai-dial-skills and @epam/ai-dial-prompts...',
  );
  const dependencyResolver = createFixtureDependencyResolver({
    workspaceRoot,
    tmpRoot,
    version: FIXTURE_PACKAGE_VERSION,
  });

  const dependencies = {
    react: lockedVersion('react'),
    'react-dom': lockedVersion('react-dom'),
    '@types/react': lockedVersion('@types/react'),
    ...dependencyResolver.resolvePeerClosure([
      ...ROOT_PACKAGES,
      ...EXTRA_DIRECT_PEERS,
    ]),
  };

  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'reusable-workflows-consumer',
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

  writeFileSync(
    path.join(dir, 'entry.ts'),
    [
      // Each package's README documents this import as the required setup
      // step — the fixture must do it too, or its CSS never reaches the build.
      `import '@epam/ai-dial-skills/styles.css';`,
      `import '@epam/ai-dial-prompts/styles.css';`,
      `export * from '@epam/ai-dial-skills';`,
      `export * from '@epam/ai-dial-prompts';`,
      // Explicitly guard the existing root API against accidental removal.
      `export { PromptParametersPopup } from '@epam/ai-dial-prompts';`,
      '',
    ].join('\n'),
  );

  console.info('Typechecking the packed artifacts...');
  const tsc = typecheckFixture(workspaceRoot, dir);
  if (!tsc.success) {
    fail(`tsc --noEmit failed:\n${tsc.output}`);
  } else {
    console.info(
      'OK: the full public surface of both packages typechecks against the packed artifacts.',
    );
  }

  console.info('Bundling the packed artifacts with Vite (library mode)...');
  const bundle = bundleFixture(workspaceRoot, dir);
  if (!bundle.success) {
    fail(`vite build failed:\n${bundle.output}`);
  } else {
    const outDir = path.dirname(bundle.bundlePath);
    const outputFiles = readdirSync(outDir);
    const mainChunkName = path.basename(bundle.bundlePath);

    // -------------------------------------------------------------------
    // Required CSS: both packages' ./styles.css must reach the build.
    // -------------------------------------------------------------------
    const cssFiles = outputFiles.filter((file) => file.endsWith('.css'));
    if (cssFiles.length === 0) {
      fail('The bundle emitted no stylesheet.');
    }
    const bundledCss = cssFiles
      .map((file) => readFileSync(path.join(outDir, file), 'utf-8'))
      .join('\n');
    const REQUIRED_CSS_VARS = [
      { pkg: '@epam/ai-dial-skills', cssVar: '--fs-header-text' },
      { pkg: '@epam/ai-dial-prompts', cssVar: '--fp-header-text' },
    ];
    for (const { pkg, cssVar } of REQUIRED_CSS_VARS) {
      if (!bundledCss.includes(cssVar)) {
        fail(
          `Built stylesheet(s) do not contain "${cssVar}" — ${pkg}'s ./styles.css may not have resolved into the build.`,
        );
      }
    }

    // -------------------------------------------------------------------
    // Feature loading boundary: the main chunk must not eagerly bundle AG
    // Grid (reachable only through usePromptSelectorOverlay's lazy-loaded
    // PromptParametersPopup -> @epam/ai-dial-catalog's ListView), while a
    // separate emitted chunk proves the split genuinely happened rather
    // than AG Grid being absent for an unrelated reason.
    // -------------------------------------------------------------------
    const AG_GRID_MARKER = 'ag-grid-community';
    const mainChunk = readFileSync(bundle.bundlePath, 'utf-8');
    if (mainChunk.includes(AG_GRID_MARKER)) {
      fail(
        `The main chunk (${mainChunkName}) contains "${AG_GRID_MARKER}" — ` +
          'usePromptSelectorOverlay is pulling AG Grid into its initial bundle instead of ' +
          'lazy-loading the component that reaches it (see usePromptSelectorOverlay.tsx).',
      );
    }
    const otherJsFiles = outputFiles.filter(
      (file) => file.endsWith('.js') && file !== mainChunkName,
    );
    const lazyChunkHasMarker = otherJsFiles.some((file) =>
      readFileSync(path.join(outDir, file), 'utf-8').includes(AG_GRID_MARKER),
    );
    if (!lazyChunkHasMarker) {
      fail(
        `No emitted chunk other than ${mainChunkName} contains "${AG_GRID_MARKER}" — ` +
          'the lazy-loading split could not be verified (expected a separate chunk carrying ' +
          'PromptParametersPopup/@epam/ai-dial-catalog).',
      );
    }

    if (exitCode === 0) {
      console.info(
        'OK: both packages bundle together, required CSS reaches the build, and AG Grid ' +
          'stays out of the main chunk while a separate lazy chunk carries it.',
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
