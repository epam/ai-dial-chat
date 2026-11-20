/*
 * Shared harness for the celebrations browser specs: the static Storybook
 * server, the capture identity and small page helpers. Extracted from
 * `celebrations-baseline.browser.spec.mjs` (S0, #9219) so later stages reuse
 * the same capture rules instead of copying them.
 *
 * Output: tmp/celebrations-baseline/<captureId>/ (Git-ignored). The capture ID
 * is the revision for a clean working tree, otherwise
 * `<revision>-wt-<fingerprint>`, so uncommitted work never lands in a revision
 * directory. A directory holding `artefacts.sha256` is finalized and is never
 * written again.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import express from 'express';

export const workspace = resolve(import.meta.dirname, '../../..');
export const storybook = resolve(import.meta.dirname, '../storybook-static');
const git = (...args) =>
  execFileSync('git', args, { cwd: workspace, maxBuffer: 512 * 1024 * 1024 });
export const revision = git('rev-parse', '--short=9', 'HEAD').toString().trim();

/* Tracked differences from HEAD plus every untracked, non-ignored file. */
const fingerprintWorkingTree = () => {
  const diff = git('diff', 'HEAD', '--binary');
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z')
    .toString()
    .split('\0')
    .filter(Boolean)
    .sort();
  if (diff.length === 0 && untracked.length === 0) return null;
  const hash = createHash('sha256').update(diff);
  for (const path of untracked)
    hash.update(`\0${path}\0`).update(readFileSync(resolve(workspace, path)));
  return hash.digest('hex').slice(0, 8);
};
export const fingerprint = fingerprintWorkingTree();
export const captureId = fingerprint
  ? `${revision}-wt-${fingerprint}`
  : revision;
export const output = resolve(
  workspace,
  'tmp/celebrations-baseline',
  captureId,
);
if (existsSync(resolve(output, 'artefacts.sha256')))
  throw new Error(
    `${output} is a finalized capture (artefacts.sha256 exists); change the working tree or commit to get a new capture identity`,
  );

/** Returns the `p` quantile of `values` (nearest rank), or `null` when empty. */
export const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

/** Waits until the page's `performance.now()` reaches `pageTime`. */
export const waitUntil = async (page, pageTime) => {
  const now = await page.evaluate(() => performance.now());
  if (pageTime > now) await page.waitForTimeout(pageTime - now);
};

/** Heap after a forced collection and the detached SVG nodes, through CDP. */
export const heapAndDetached = async (cdp) => {
  const result = { heapUsedBytes: null, detachedSvgNodes: null };
  try {
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.collectGarbage');
    result.heapUsedBytes = (await cdp.send('Runtime.getHeapUsage')).usedSize;
  } catch (error) {
    result.heapError = String(error.message ?? error);
  }
  try {
    await cdp.send('DOM.enable');
    const { detachedNodes } = await cdp.send('DOM.getDetachedDomNodes');
    const count = (node) =>
      (node.nodeName?.toLowerCase() === 'svg' ? 1 : 0) +
      (node.children ?? []).reduce((sum, child) => sum + count(child), 0);
    result.detachedSvgNodes = detachedNodes.reduce(
      (sum, { treeNode }) => sum + count(treeNode),
      0,
    );
    result.detachedRoots = detachedNodes.length;
  } catch (error) {
    result.detachedError = String(error.message ?? error);
  }
  return result;
};

/** Serves the static Storybook build on a free local port. */
export const startServer = async () => {
  assert.ok(
    existsSync(resolve(storybook, 'index.json')),
    'run build-storybook first (the Nx target depends on it)',
  );
  const app = express();
  app.use(express.static(storybook));
  const server = await new Promise((resolveServer) => {
    const instance = app.listen(0, '127.0.0.1', () => resolveServer(instance));
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
};

/**
 * Saves a viewport PNG through CDP. Playwright's `page.screenshot()` re-applies
 * the device metrics of a mobile-emulated context, which resizes the visual
 * viewport and correctly cancels any playing scene; `Page.captureScreenshot`
 * leaves the metrics alone.
 */
export const captureFrame = async (cdp, path) => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await writeFile(path, Buffer.from(data, 'base64'));
};
