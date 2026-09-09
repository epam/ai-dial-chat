import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { cleanupDir, createFixtureDependencyResolver } from './harness.mjs';
import {
  buildProbePackedFixture,
  buildProbeSourceFixture,
  PROBE_DEFINITIONS,
  assertProbeIsolation,
  probeBudget,
} from './cold-load-probes.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const chatHooksRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(chatHooksRoot, '..', '..');
const keepFixtures = process.env.KEEP_FIXTURES === '1';
let tmpRoot;
let dependencyResolver;
let reactVersion;
const report = {};
before(() => {
  tmpRoot = mkdtempSync(
    path.join(os.tmpdir(), 'ai-dial-chat-cold-load-probes-'),
  );
  dependencyResolver = createFixtureDependencyResolver({
    workspaceRoot,
    tmpRoot,
    version: '0.0.0-packed.0',
  });
  const workspaceLock = JSON.parse(
    readFileSync(path.join(workspaceRoot, 'package-lock.json'), 'utf8'),
  );
  reactVersion =
    workspaceLock.packages?.['node_modules/react']?.version ??
    (() => {
      throw new Error('package-lock.json has no exact root version for react');
    })();
});
after(() => {
  const reportPath = path.join(
    os.tmpdir(),
    'ai-dial-chat-cold-load-probes-report.json',
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.info(`\nPersisted cold-load-probes report: ${reportPath}`);
  if (!keepFixtures) cleanupDir(tmpRoot);
  else console.info(`KEEP_FIXTURES=1 set — fixtures left at: ${tmpRoot}`);
});
for (const probe of PROBE_DEFINITIONS) {
  test(`${probe.name}: packed cost vs source for ${probe.exportName}`, () => {
    const source = buildProbeSourceFixture({ workspaceRoot, tmpRoot, probe });
    assert.equal(
      source.pass,
      true,
      `source fixture for ${probe.name} must build (aliasing straight to src):\n${source.output ?? ''}`,
    );
    const packed = buildProbePackedFixture({
      workspaceRoot,
      tmpRoot,
      probe,
      dependencyResolver,
      reactVersion,
    });
    report[probe.name] = {
      source: source.pass
        ? { initialJs: source.initialJs, initialCss: source.initialCss }
        : { failed: true },
      packed: packed.pass
        ? { initialJs: packed.initialJs, initialCss: packed.initialCss }
        : { failed: true, output: packed.output },
    };
    assert.equal(
      packed.pass,
      true,
      `Packed fixture ${probe.name} failed with its documented peers:\n${packed.output ?? ''}`,
    );
    report[probe.name].budget = probeBudget(probe);
    assertProbeIsolation(probe, source);
    assertProbeIsolation(probe, packed);
  });
}
