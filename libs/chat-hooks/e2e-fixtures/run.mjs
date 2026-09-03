#!/usr/bin/env node
/**
 * Packed-package consumer fixture runner (design.md D5, tasks.md §6). Wired
 * as the `@epam/ai-dial-chat-hooks:test-packed` Nx target, which runs this
 * after `build` so `dist/` is fresh.
 *
 * For each fixture: pack `dist/` into a real tarball (once, shared across
 * fixtures), `npm install` it plus the fixture's documented peers into an
 * isolated directory, typecheck a consumer file that imports the subpath
 * under test, and bundle it with Vite (library mode) — the same bundler
 * every real consumer of this package in this workspace uses.
 *
 * Run directly for local debugging: `node libs/chat-hooks/e2e-fixtures/run.mjs`.
 * Set `KEEP_FIXTURES=1` to skip the final cleanup and inspect a fixture's
 * `node_modules`/typecheck/bundle output by hand.
 *
 * Run the full matrix:
 *   npm exec nx run @epam/ai-dial-chat-hooks:test-packed
 * Run the PR smoke suite:
 *   npm exec nx run @epam/ai-dial-chat-hooks:test-packed-smoke
 */

import { existsSync, mkdtempSync, readFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  bundleFixture,
  cleanupDir,
  createFixtureDir,
  formatExecError,
  npmInstallFixture,
  packChatHooks,
  readBundle,
  resolveFixturePublishVersion,
  typecheckFixture,
  verifyDeclarationImports,
  verifyMinimalPeerIsolation,
  verifySideEffectManifest,
  writeEntryFile,
  writeFixturePackageJson,
  writeSideEffectEntryFile,
} from './harness.mjs';
import {
  LEGACY_ROOT_FIXTURE,
  MINIMAL_FIXTURE,
  NEGATIVE_FIXTURE,
  SIDE_EFFECT_CHECKS,
  SIDE_EFFECT_SYMBOLS,
  SUBPATH_FIXTURES,
} from './fixtures.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const chatHooksRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(chatHooksRoot, '..', '..');
/*
 * Deliberately outside this repo checkout — see createFixtureDir's doc
 * comment in harness.mjs for why nesting fixtures inside the repo (even in
 * a git-ignored folder) silently breaks the isolation this harness exists
 * to test.
 */
const tmpRoot = mkdtempSync(
  path.join(os.tmpdir(), 'ai-dial-chat-hooks-e2e-fixtures-'),
);
const keepFixtures = process.env.KEEP_FIXTURES === '1';

const chatHooksPkg = JSON.parse(
  readFileSync(path.join(chatHooksRoot, 'package.json'), 'utf8'),
);
const reactRange = chatHooksPkg.peerDependencies.react;
const workspacePkg = JSON.parse(
  readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8'),
);
const reactTypesRange = workspacePkg.devDependencies['@types/react'];

/*
 * The PR gate covers the package-wide artifact contract, optional-peer
 * isolation, one representative side-effectful entry, and the missing-peer
 * diagnostic. The remaining subpath and legacy-root consumers stay in the
 * full suite for future nightly/release wiring.
 */
const SMOKE_FIXTURE_NAMES = new Set([
  MINIMAL_FIXTURE.name,
  'oauth',
  NEGATIVE_FIXTURE.name,
]);

/**
 * Runs one fixture end to end and returns a report. `expectFailure` fixtures
 * (the negative case) pass when typecheck or bundling fails and the combined
 * diagnostic names `failureMustName` literally; every other fixture passes
 * only when installation, contract checks, typecheck, and bundling succeed.
 */
const runFixture = (
  { name, subpath, peers, expectFailure, failureMustName },
  tarballPath,
) => {
  const dir = createFixtureDir(tmpRoot, name);
  const steps = [];

  writeFixturePackageJson(dir, {
    name: `chat-hooks-e2e-fixture-${name}`,
    tarballPath,
    reactRange,
    reactTypesRange,
    peers,
  });

  try {
    npmInstallFixture(dir);
    steps.push({ step: 'npm install', success: true });
  } catch (err) {
    steps.push({
      step: 'npm install',
      success: false,
      output: formatExecError(err),
    });
    return { name, dir, pass: false, steps, bundlePath: null };
  }

  if (name === MINIMAL_FIXTURE.name) {
    steps.push({
      step: 'minimal peer isolation',
      ...verifyMinimalPeerIsolation(dir),
    });
  }

  writeEntryFile(dir, subpath);

  steps.push({
    step: 'rolled declaration imports resolve',
    ...verifyDeclarationImports(dir, subpath),
  });

  const tsc = typecheckFixture(workspaceRoot, dir);
  steps.push({ step: 'tsc --noEmit', ...tsc });

  const bundle = bundleFixture(workspaceRoot, dir);
  steps.push({ step: 'vite build', ...bundle });

  if (expectFailure) {
    const failingSteps = steps.filter(
      (step) => step.step !== 'npm install' && !step.success,
    );
    const failureOutput = failingSteps.map((step) => step.output).join('\n');
    const pass =
      failingSteps.length > 0 && failureOutput.includes(failureMustName);
    return {
      name,
      dir,
      pass,
      steps,
      bundlePath: bundle.bundlePath,
      expectFailure,
      failureMustName,
    };
  }

  const pass = steps.every((step) => step.success);
  return { name, dir, pass, steps, bundlePath: bundle.bundlePath };
};

/**
 * `--suite=smoke` selects the stable PR smoke set. `--only=name1,name2`
 * restricts a local debugging run to named fixtures. Side-effect checks still
 * run, but only report on whichever of `minimal`/`oauth`/`file-manager` the
 * selected run includes.
 */
const suiteArg = process.argv.find((arg) => arg.startsWith('--suite='));
const suite = suiteArg?.slice('--suite='.length);
const onlyArg = process.argv.find((arg) => arg.startsWith('--only='));
const only = onlyArg
  ? new Set(onlyArg.slice('--only='.length).split(','))
  : null;

const main = () => {
  if (suite && suite !== 'smoke') {
    throw new Error(`Unknown packed-fixture suite: ${suite}`);
  }
  if (suite && only) {
    throw new Error('Use either --suite or --only, not both');
  }

  const allFixtureDefs = [
    ...SUBPATH_FIXTURES,
    LEGACY_ROOT_FIXTURE,
    NEGATIVE_FIXTURE,
  ];
  const selectedFixtureNames = suite === 'smoke' ? SMOKE_FIXTURE_NAMES : only;
  if (selectedFixtureNames) {
    const knownFixtureNames = new Set(allFixtureDefs.map((def) => def.name));
    const unknownFixtureNames = [...selectedFixtureNames].filter(
      (name) => !knownFixtureNames.has(name),
    );
    if (unknownFixtureNames.length) {
      throw new Error(
        `Unknown packed fixture(s): ${unknownFixtureNames.join(', ')}`,
      );
    }
  }

  console.info('Packing @epam/ai-dial-chat-hooks/dist into a tarball...');
  const fixturePublishVersion = resolveFixturePublishVersion(chatHooksPkg.name);
  const packedArtifact = packChatHooks({
    workspaceRoot,
    chatHooksRoot,
    tmpRoot,
    version: fixturePublishVersion,
  });
  const { tarballPath } = packedArtifact;
  console.info(`Packed: ${tarballPath}\n`);

  let fixtureDefs = allFixtureDefs;
  if (selectedFixtureNames) {
    fixtureDefs = fixtureDefs.filter((def) =>
      selectedFixtureNames.has(def.name),
    );
    console.info(
      `${suite ? `${suite} suite` : '--only filter'} active: running ${fixtureDefs.map((d) => d.name).join(', ')}\n`,
    );
  }

  const results = new Map();
  for (const def of fixtureDefs) {
    console.info(`Running fixture: ${def.name} (./${def.subpath})...`);
    const result = runFixture(def, tarballPath);
    results.set(def.name, result);
    console.info(`  ${result.pass ? 'PASS' : 'FAIL'}`);
  }

  // Task 6.6: the minimal fixture's bundle must retain neither side-effect
  // symbol; each named heavy fixture's bundle must retain its own. Skipped
  // (not failed) for a fixture `--only` excluded from this run.
  const sideEffectResults = [
    {
      check: 'published sideEffects covers every audited emitted chunk',
      pass: false,
      detail: '',
    },
  ];
  const sideEffectManifest = verifySideEffectManifest(
    packedArtifact,
    SIDE_EFFECT_SYMBOLS,
  );
  sideEffectResults[0] = {
    check: 'published sideEffects covers every audited emitted chunk',
    pass: sideEffectManifest.success,
    detail: sideEffectManifest.output,
  };
  const minimalResult = results.get(MINIMAL_FIXTURE.name);
  if (minimalResult) {
    const minimalBundlePath = minimalResult.bundlePath;
    if (minimalBundlePath && existsSync(minimalBundlePath)) {
      const minimalBundle = readBundle(minimalBundlePath);
      const leaked = SIDE_EFFECT_SYMBOLS.filter((symbol) =>
        minimalBundle.includes(symbol),
      );
      sideEffectResults.push({
        check: `minimal bundle excludes ${SIDE_EFFECT_SYMBOLS.join(', ')}`,
        pass: leaked.length === 0,
        detail: leaked.length ? `found: ${leaked.join(', ')}` : '',
      });
    } else {
      sideEffectResults.push({
        check: `minimal bundle excludes ${SIDE_EFFECT_SYMBOLS.join(', ')}`,
        pass: false,
        detail: 'minimal fixture did not produce a bundle to inspect',
      });
    }
  }
  for (const { fixtureName, mustContain } of SIDE_EFFECT_CHECKS) {
    if (selectedFixtureNames && !selectedFixtureNames.has(fixtureName))
      continue;
    const fixtureResult = results.get(fixtureName);
    if (!fixtureResult?.bundlePath || !existsSync(fixtureResult.bundlePath)) {
      sideEffectResults.push({
        check: `${fixtureName} bundle retains ${mustContain.join(', ')}`,
        pass: false,
        detail: `${fixtureName} fixture did not produce a bundle to inspect`,
      });
      continue;
    }
    writeSideEffectEntryFile(fixtureResult.dir, fixtureName);
    const sideEffectBundleResult = bundleFixture(
      workspaceRoot,
      fixtureResult.dir,
      {
        outDir: 'dist-side-effect-check',
      },
    );
    if (!sideEffectBundleResult.success) {
      sideEffectResults.push({
        check: `${fixtureName} side-effect-only import builds`,
        pass: false,
        detail: sideEffectBundleResult.output,
      });
      continue;
    }
    const bundle = readBundle(sideEffectBundleResult.bundlePath);
    const missing = mustContain.filter((symbol) => !bundle.includes(symbol));
    sideEffectResults.push({
      check: `${fixtureName} bundle retains ${mustContain.join(', ')}`,
      pass: missing.length === 0,
      detail: missing.length ? `missing: ${missing.join(', ')}` : '',
    });
  }

  console.info('\n--- Summary ---');
  let allPass = true;
  for (const result of results.values()) {
    console.info(`${result.pass ? 'PASS' : 'FAIL'}  fixture: ${result.name}`);
    if (!result.pass) {
      allPass = false;
      for (const step of result.steps) {
        if (step.success === false) {
          console.info(`  failed at: ${step.step}`);
          console.info(
            step.output
              .split('\n')
              .slice(0, 20)
              .map((line) => `    ${line}`)
              .join('\n'),
          );
        }
      }
    }
  }
  for (const check of sideEffectResults) {
    console.info(
      `${check.pass ? 'PASS' : 'FAIL'}  side-effect check: ${check.check}`,
    );
    if (!check.pass) {
      allPass = false;
      console.info(`  ${check.detail}`);
    }
  }

  if (!keepFixtures) {
    cleanupDir(tmpRoot);
  } else {
    console.info(`\nKEEP_FIXTURES=1 set — fixtures left at: ${tmpRoot}`);
  }

  if (!allPass) {
    console.error('\nOne or more packed-package fixtures failed.');
    process.exit(1);
  }
  console.info('\nAll packed-package fixtures passed.');
};

main();
