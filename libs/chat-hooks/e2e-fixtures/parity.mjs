#!/usr/bin/env node
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { cleanupDir, createFixtureDependencyResolver } from './harness.mjs';
import {
  assertApplicationBudget,
  buildPackedFixture,
  buildSourceFixture,
  HARD_EXCLUDED_MODULE_MARKERS,
  matchesForbiddenOrigin,
  recordProvenance,
} from './application-mode.mjs';
const forbiddenPathSegments = HARD_EXCLUDED_MODULE_MARKERS;
const MAX_PACKED_VS_SOURCE_RATIO = 1.2;
const here = path.dirname(fileURLToPath(import.meta.url));
const chatHooksRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(chatHooksRoot, '..', '..');
const tmpRoot = mkdtempSync(
  path.join(os.tmpdir(), 'ai-dial-chat-application-mode-fixtures-'),
);
const keepFixtures = process.env.KEEP_FIXTURES === '1';
const workspaceLock = JSON.parse(
  readFileSync(path.join(workspaceRoot, 'package-lock.json'), 'utf8'),
);
const readLockedVersion = (packageName) =>
  workspaceLock.packages?.[`node_modules/${packageName}`]?.version ??
  (() => {
    throw new Error(
      `package-lock.json has no exact root version for ${packageName}`,
    );
  })();
const reactVersion = readLockedVersion('react');
const reactDomVersion = readLockedVersion('react-dom');
const formatBytes = ({ raw, gzip }) => `${raw} B raw / ${gzip} B gzip`;
const ratioOf = (packedBytes, sourceBytes) =>
  sourceBytes === 0
    ? packedBytes === 0
      ? 1
      : Infinity
    : packedBytes / sourceBytes;
const main = () => {
  const provenance = recordProvenance(workspaceRoot);
  console.info(
    `Provenance: git ${provenance.gitSha}${provenance.dirty ? ' (dirty, content hash ' + provenance.dirtyContentHash.slice(0, 12) + ')' : ''}, ` +
      `vite ${provenance.viteVersion}, react ${provenance.reactVersion}`,
  );
  console.info(
    'Building source-mode application fixture (libs/*/src aliases, React bundled)...',
  );
  const source = buildSourceFixture({ workspaceRoot, tmpRoot });
  if (!source.pass) {
    console.error('FAIL  source fixture failed to build:\n' + source.output);
    if (!keepFixtures) cleanupDir(tmpRoot);
    process.exit(1);
  }
  console.info(`  initial JS: ${formatBytes(source.initialJs)}`);
  console.info(`  initial CSS: ${formatBytes(source.initialCss)}`);
  console.info(`  dynamic chunks: ${source.dynamicChunks.length}`);
  console.info(
    '\nPacking @epam/ai-dial-chat-hooks/@epam/ai-dial-chat-shared/@epam/ai-dial-catalog/@epam/ai-dial-publish-panel and building the packed application fixture...',
  );
  const dependencyResolver = createFixtureDependencyResolver({
    workspaceRoot,
    tmpRoot,
    version: '0.0.0-packed.0',
  });
  const packed = buildPackedFixture({
    workspaceRoot,
    tmpRoot,
    dependencyResolver,
    reactVersion,
    reactDomVersion,
  });
  if (!packed.pass) {
    console.error('FAIL  packed fixture failed to build:\n' + packed.output);
    if (!keepFixtures) cleanupDir(tmpRoot);
    process.exit(1);
  }
  console.info(`  initial JS: ${formatBytes(packed.initialJs)}`);
  console.info(`  initial CSS: ${formatBytes(packed.initialCss)}`);
  console.info(`  dynamic chunks: ${packed.dynamicChunks.length}`);
  assertApplicationBudget(source);
  assertApplicationBudget(packed);
  const rawJsRatio = ratioOf(packed.initialJs.raw, source.initialJs.raw);
  const gzipJsRatio = ratioOf(packed.initialJs.gzip, source.initialJs.gzip);
  const rawCssRatio = ratioOf(packed.initialCss.raw, source.initialCss.raw);
  const gzipCssRatio = ratioOf(packed.initialCss.gzip, source.initialCss.gzip);
  const rawJsPass = rawJsRatio <= MAX_PACKED_VS_SOURCE_RATIO;
  const gzipJsPass = gzipJsRatio <= MAX_PACKED_VS_SOURCE_RATIO;
  const rawCssPass = rawCssRatio <= MAX_PACKED_VS_SOURCE_RATIO;
  const gzipCssPass = gzipCssRatio <= MAX_PACKED_VS_SOURCE_RATIO;
  console.info(
    `\nPacked/source initial-JS ratio: ${rawJsRatio.toFixed(3)} raw / ${gzipJsRatio.toFixed(3)} gzip (budget: ${MAX_PACKED_VS_SOURCE_RATIO})`,
  );
  console.info(
    `Packed/source initial-CSS ratio: ${rawCssRatio.toFixed(3)} raw / ${gzipCssRatio.toFixed(3)} gzip (budget: ${MAX_PACKED_VS_SOURCE_RATIO})`,
  );
  const foundOriginMarkers = matchesForbiddenOrigin(
    packed,
    forbiddenPathSegments,
  );
  const exclusionPass = foundOriginMarkers.length === 0;
  const resolutionAuditPass = packed.resolutionAudit.pass;
  console.info('\n--- Summary ---');
  console.info(
    `${rawJsPass ? 'PASS' : 'FAIL'}  packed initial JS (raw) within ${MAX_PACKED_VS_SOURCE_RATIO}x of source (${rawJsRatio.toFixed(3)})`,
  );
  console.info(
    `${gzipJsPass ? 'PASS' : 'FAIL'}  packed initial JS (gzip) within ${MAX_PACKED_VS_SOURCE_RATIO}x of source (${gzipJsRatio.toFixed(3)})`,
  );
  console.info(
    `${rawCssPass ? 'PASS' : 'FAIL'}  packed initial CSS (raw) within ${MAX_PACKED_VS_SOURCE_RATIO}x of source (${rawCssRatio.toFixed(3)})`,
  );
  console.info(
    `${gzipCssPass ? 'PASS' : 'FAIL'}  packed initial CSS (gzip) within ${MAX_PACKED_VS_SOURCE_RATIO}x of source (${gzipCssRatio.toFixed(3)})`,
  );
  console.info(
    `${exclusionPass ? 'PASS' : 'FAIL'}  packed application-mode bundle excludes ${HARD_EXCLUDED_MODULE_MARKERS.join(', ')}${foundOriginMarkers.length ? ` (found origin: ${foundOriginMarkers.join(', ')})` : ''}`,
  );
  console.info(
    `${resolutionAuditPass ? 'PASS' : 'FAIL'}  packed initial closure resolves only to its own node_modules${resolutionAuditPass ? '' : ` (violations: ${packed.resolutionAudit.violations.join(', ')})`}`,
  );
  if (packed.largeModules.length) {
    console.info('\nModules above the 50 KB size threshold (packed fixture):');
    for (const { file, bytes } of packed.largeModules) {
      console.info(`  ${file}: ${bytes} B`);
    }
  }
  if (packed.heaviestOriginPackages.length) {
    console.info(
      '\nHeaviest origin packages/source-dirs in the packed initial closure:',
    );
    for (const { origin, bytes } of packed.heaviestOriginPackages.slice(
      0,
      15,
    )) {
      console.info(`  ${origin}: ${bytes} B`);
    }
  }
  const overallPass =
    rawJsPass &&
    gzipJsPass &&
    rawCssPass &&
    gzipCssPass &&
    exclusionPass &&
    resolutionAuditPass;
  const reportPath = path.join(
    os.tmpdir(),
    'ai-dial-chat-application-mode-parity-report.json',
  );
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        provenance,
        tarballHashes: packed.tarballHashes,
        source: { initialJs: source.initialJs, initialCss: source.initialCss },
        packed: { initialJs: packed.initialJs, initialCss: packed.initialCss },
        ratioBudget: MAX_PACKED_VS_SOURCE_RATIO,
        ratios: {
          rawJsRatio,
          gzipJsRatio,
          rawCssRatio,
          gzipCssRatio,
        },
        checks: {
          rawJsPass,
          gzipJsPass,
          rawCssPass,
          gzipCssPass,
          exclusionPass,
          resolutionAuditPass,
        },
        foundOriginMarkers,
        resolutionAuditViolations: packed.resolutionAudit.violations,
        heaviestOriginPackages: packed.heaviestOriginPackages,
        overallPass,
      },
      null,
      2,
    ),
  );
  console.info(`\nPersisted report: ${reportPath}`);
  if (!keepFixtures) {
    cleanupDir(tmpRoot);
  } else {
    console.info(`\nKEEP_FIXTURES=1 set — fixtures left at: ${tmpRoot}`);
  }
  if (!overallPass) {
    console.error('\nApplication-mode parity check failed.');
    process.exit(1);
  }
  console.info('\nApplication-mode parity check passed.');
};
main();
