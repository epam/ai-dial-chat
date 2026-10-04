/*
 * S0 browser baseline (#9219) for the sleigh, gift-wrapping and cat scenes.
 *
 * Runs the real CelebrationProvider through the static Storybook build
 * (`build-storybook`, a dependency of the Nx target) and records what the
 * scenes do today. It measures; apart from harness invariants and the two
 * reduced-motion / cancelled-load guarantees in the S0 spec, it asserts
 * nothing about the numbers it records.
 *
 * The Nx target runs every test. To run one, call Node directly from
 * libs/celebrations, e.g. `node --test --test-name-pattern='^cat baseline'
 * browser-tests/celebrations-baseline.browser.spec.mjs`.
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
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import express from 'express';
import { chromium } from 'playwright';

const workspace = resolve(import.meta.dirname, '../../..');
const storybook = resolve(import.meta.dirname, '../storybook-static');
const git = (...args) =>
  execFileSync('git', args, { cwd: workspace, maxBuffer: 512 * 1024 * 1024 });
const revision = git('rev-parse', '--short=9', 'HEAD').toString().trim();

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
const fingerprint = fingerprintWorkingTree();
const captureId = fingerprint ? `${revision}-wt-${fingerprint}` : revision;
const output = resolve(workspace, 'tmp/celebrations-baseline', captureId);
if (existsSync(resolve(output, 'artefacts.sha256')))
  throw new Error(
    `${output} is a finalized capture (artefacts.sha256 exists); change the working tree or commit to get a new capture identity`,
  );
const SEED = 9219;
const CYCLES = 20;

/* Lifetimes and story clocks, from new-year/constants/new-year.ts,
   halloween/constants/halloween.ts and the scenes' own composition files. */
const SCENES = {
  sleigh: {
    story: 'new-year-scenes--sleigh',
    durationMs: 12000,
    /* No renderer: the CSS flights start when the layer mounts. */
    ready: null,
    playbackMs: { desktop: 10100, mobile: 9250 },
    readsAnchors: false,
  },
  'gift-wrapping': {
    story: 'new-year-scenes--gift-wrapping',
    durationMs: 18500,
    /* The Lottie renderer's svg, or the static elves of the fallback. */
    ready: '[data-new-year-scene="gift-wrapping"] svg, [data-gift-static]',
    playbackMs: { desktop: 16000, mobile: 16000 },
    readsAnchors: true,
  },
  cat: {
    story: 'halloween-scenes--cat',
    durationMs: 25500,
    ready: '[data-halloween-scene="cat"][data-ready="true"]',
    playbackMs: { desktop: 25000, mobile: 25000 },
    readsAnchors: true,
  },
};

const VIEWPORTS = {
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    layout: 'desktop',
  },
  mobile390: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
    layout: 'mobile',
  },
  mobile360: {
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    layout: 'mobile',
  },
};

/* Chrome DevTools "Slow 4G" values: 562.5 ms latency, 1.6 Mbit/s down and
   750 kbit/s up, each at the DevTools 0.9 goodput factor. */
const SLOW_4G = {
  offline: false,
  latency: 562.5,
  downloadThroughput: (1.6 * 1000 * 1000 * 0.9) / 8,
  uploadThroughput: (750 * 1000 * 0.9) / 8,
};

/* Runs in the page before any Storybook script. */
const instrumentPage = ({ seed, dir, readySelector, removeComposer }) => {
  let state = seed >>> 0;
  /* mulberry32: every Math.random caller, including pickCelebrationScene. */
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /* At document start <html> may not exist yet; the observer below re-applies. */
  const applyDir = () => {
    if (document.documentElement && document.documentElement.dir !== dir)
      document.documentElement.dir = dir;
  };
  const baseline = {
    frames: [],
    longTasks: [],
    mounts: [],
    readies: [],
    renderers: [],
  };
  window.__baseline = baseline;
  applyDir();
  const tick = (time) => {
    baseline.frames.push(time);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        baseline.longTasks.push({
          start: entry.startTime,
          duration: entry.duration,
        });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    baseline.longTasksUnsupported = true;
  }
  const layers = new WeakSet();
  const ready = new WeakSet();
  const svgs = new WeakSet();
  new MutationObserver(() => {
    const now = performance.now();
    applyDir();
    for (const layer of document.querySelectorAll(
      '.dial-celebrations-scene-layer',
    ))
      if (!layers.has(layer)) {
        layers.add(layer);
        baseline.mounts.push(now);
      }
    if (readySelector)
      for (const element of document.querySelectorAll(readySelector))
        if (!ready.has(element)) {
          ready.add(element);
          baseline.readies.push(now);
        }
    for (const svg of document.querySelectorAll(
      '.dial-celebrations-scene-layer [data-new-year-scene] svg',
    ))
      if (!svgs.has(svg)) {
        svgs.add(svg);
        baseline.renderers.push(now);
      }
    if (removeComposer)
      for (const composer of document.querySelectorAll('.story-composer'))
        composer.classList.remove('story-composer');
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-ready'],
  });
};

const sample = () => {
  const layer = document.querySelector('.dial-celebrations-scene-layer');
  const snapshots = [
    ...document.querySelectorAll('[data-celebration-snapshot]'),
  ];
  const scene = layer?.querySelector(
    '[data-new-year-scene], [data-halloween-scene], [data-gift-static]',
  );
  return {
    t: performance.now(),
    layerPresent: Boolean(layer),
    layerElements: layer ? layer.getElementsByTagName('*').length : 0,
    layerSvgs: layer ? layer.getElementsByTagName('svg').length : 0,
    snapshotWrappers: snapshots.length,
    snapshotNodes: snapshots.reduce(
      (sum, wrapper) => sum + wrapper.getElementsByTagName('*').length,
      0,
    ),
    animations: document.getAnimations().length,
    documentElements: document.getElementsByTagName('*').length,
    sceneState: scene
      ? Object.fromEntries(
          [...scene.attributes]
            .filter(({ name }) => name.startsWith('data-'))
            .map(({ name, value }) => [name, value]),
        )
      : null,
    catFallback: Boolean(layer?.querySelector('[data-cat-fallback]')),
    catActor: Boolean(layer?.querySelector('[data-cat-actor]')),
  };
};

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
};

const frameStats = async (page, from, to) =>
  page.evaluate(
    ({ from, to }) => {
      const { frames, longTasks, longTasksUnsupported } = window.__baseline;
      const inside = frames.filter((time) => time >= from && time <= to);
      const deltas = inside.slice(1).map((time, i) => time - inside[i]);
      const tasks = longTasks.filter(
        ({ start }) => start >= from && start <= to,
      );
      return {
        deltas,
        longTaskCount: longTasksUnsupported ? null : tasks.length,
        longTaskTotalMs: longTasksUnsupported
          ? null
          : tasks.reduce((sum, { duration }) => sum + duration, 0),
      };
    },
    { from, to },
  );

const summarizeFrames = ({ deltas, longTaskCount, longTaskTotalMs }) => ({
  frames: deltas.length,
  p50FrameMs: percentile(deltas, 0.5),
  p95FrameMs: percentile(deltas, 0.95),
  maxFrameMs: deltas.length ? Math.max(...deltas) : null,
  longTaskCount,
  longTaskTotalMs,
});

const waitUntil = async (page, pageTime) => {
  const now = await page.evaluate(() => performance.now());
  if (pageTime > now) await page.waitForTimeout(pageTime - now);
};

const waitFor = async (page, key, index, timeout) => {
  await page.waitForFunction(
    ({ key, index }) => window.__baseline[key].length > index,
    { key, index },
    { timeout, polling: 'raf' },
  );
  return page.evaluate(({ key, index }) => window.__baseline[key][index], {
    key,
    index,
  });
};

const pointerDown = async (page) => {
  await page.mouse.move(2, 2);
  await page.mouse.down();
  await page.mouse.up();
};

const heapAndDetached = async (cdp) => {
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

const storyUrl = (base, scene, { layout, dir, reduced }) => {
  const args = [
    `isMobile:!${layout === 'mobile'}`,
    `dir:${dir}`,
    `isReducedMotion:!${reduced}`,
  ].join(';');
  return `${base}/iframe.html?id=${SCENES[scene].story}&viewMode=story&args=${args}`;
};

const startServer = async () => {
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

const openContext = async (browser, viewportKey, reduced) => {
  const { layout: _layout, ...options } = VIEWPORTS[viewportKey];
  return browser.newContext({
    ...options,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
};

const recordRequests = (page, sink) => {
  page.on('requestfinished', async (request) => {
    try {
      const sizes = await request.sizes();
      sink.push({
        url: new URL(request.url()).pathname,
        wallTime: Date.now(),
        responseBodySize: sizes.responseBodySize,
        responseHeadersSize: sizes.responseHeadersSize,
      });
    } catch {
      /* A request finishing after the context closed has no sizes. */
    }
  });
};

/*
 * One matrix cell. `pass` is `metrics` (no screenshots, no trace, so capture
 * does not disturb frame timing) or `frames` (screenshots at every capture
 * point plus a Playwright trace).
 */
const runCell = async (browser, base, cell, pass) => {
  const config = SCENES[cell.scene];
  const layout = VIEWPORTS[cell.viewport].layout;
  const directory = resolve(output, cell.scene, cell.id);
  await mkdir(resolve(directory, 'frames'), { recursive: true });
  const context = await openContext(browser, cell.viewport, cell.reduced);
  if (pass === 'frames')
    await context.tracing.start({ screenshots: true, snapshots: true });
  await context.addInitScript(instrumentPage, {
    seed: SEED,
    dir: cell.dir,
    readySelector: config.ready,
    removeComposer: cell.removeComposer ?? false,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  if (cell.network === 'slow-4g') {
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', SLOW_4G);
  }
  let releasePlayer;
  if (cell.cancel === 'load') {
    const gate = new Promise((resolveGate) => {
      releasePlayer = resolveGate;
    });
    await page.route('**/lottie_light-*.js', async (route) => {
      await gate;
      await route.continue();
    });
  }
  const requests = [];
  recordRequests(page, requests);
  const samples = [];
  const capture = async (label) => {
    samples.push({ label, ...(await page.evaluate(sample)) });
    if (pass === 'frames')
      await page.screenshot({
        path: resolve(directory, 'frames', `${pass}-${label}.png`),
      });
  };
  await page.goto(storyUrl(base, cell.scene, { ...cell, layout }));
  const mounted = await waitFor(page, 'mounts', 0, 120000);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await capture('activation');
  const end = mounted + config.durationMs;
  const events = {};

  if (cell.cancel === 'load') {
    await page.waitForTimeout(200);
    events.pointerDownAt = await page.evaluate(() => performance.now());
    await pointerDown(page);
    await capture('cancel');
    releasePlayer();
    await page.waitForTimeout(1500);
    await capture('after-release');
  }

  let readyAt = null;
  if (config.ready && cell.cancel !== 'load') {
    try {
      readyAt = await waitFor(page, 'readies', 0, config.durationMs);
      await capture('ready');
    } catch {
      events.readyTimedOut = true;
    }
  }
  if (cell.cancel === 'prepare') {
    events.pointerDownAt = await page.evaluate(() => performance.now());
    await pointerDown(page);
    await capture('cancel');
  }
  const playbackStart = readyAt ?? mounted;
  if (cell.cancel === 'half') {
    await waitUntil(page, playbackStart + config.playbackMs[layout] / 2);
    events.pointerDownAt = await page.evaluate(() => performance.now());
    await pointerDown(page);
    await capture('cancel');
    await page.waitForTimeout(500);
    await capture('cancel+500');
  }
  for (const fraction of [0.25, 0.5, 0.75]) {
    const at = mounted + config.durationMs * fraction;
    if (at > (await page.evaluate(() => performance.now()))) {
      await waitUntil(page, at);
      await capture(`${fraction * 100}%`);
    }
  }
  await waitUntil(page, end);
  await capture('end');
  await waitUntil(page, end + 500);
  await capture('end+500');

  const stats = summarizeFrames(await frameStats(page, mounted, end));
  const renderers = await page.evaluate(() => window.__baseline.renderers);
  const resources = await heapAndDetached(cdp);
  const activationWall = timeOrigin + mounted;
  const result = {
    scene: cell.scene,
    cell: cell.id,
    pass,
    controls: {
      viewport: cell.viewport,
      ...VIEWPORTS[cell.viewport],
      dir: cell.dir,
      reducedMotion: cell.reduced,
      removeComposer: cell.removeComposer ?? false,
      network: cell.network ?? 'unthrottled',
      cancel: cell.cancel ?? null,
      seed: SEED,
    },
    timing: {
      mountedAt: mounted,
      readyAfterMountMs: readyAt === null ? null : readyAt - mounted,
      rendererInsertsAfterMountMs: renderers.map((time) => time - mounted),
      pointerDownAfterMountMs:
        events.pointerDownAt === undefined
          ? null
          : events.pointerDownAt - mounted,
      readyTimedOut: events.readyTimedOut ?? false,
    },
    frames: stats,
    samples,
    requests: {
      total: requests.length,
      totalResponseBytes: requests.reduce(
        (sum, { responseBodySize }) => sum + responseBodySize,
        0,
      ),
      afterActivation: requests
        .filter(({ wallTime }) => wallTime >= activationWall)
        .map(({ url, responseBodySize }) => ({ url, responseBodySize })),
      lottie: requests
        .filter(({ url }) => url.includes('lottie_light'))
        .map(({ url, responseBodySize, wallTime }) => ({
          url,
          responseBodySize,
          afterActivationMs: wallTime - activationWall,
        })),
    },
    resources,
  };
  await writeFile(
    resolve(directory, `${pass}.json`),
    JSON.stringify(result, null, 2),
  );
  if (pass === 'frames')
    await context.tracing.stop({ path: resolve(directory, 'trace.zip') });
  await context.close();
  return result;
};

/* Twenty activations in one page; each one after the first presses Replay. */
const runCycles = async (browser, base, scene, mode) => {
  const config = SCENES[scene];
  const directory = resolve(output, scene, `cycles-${mode}`);
  await mkdir(directory, { recursive: true });
  const context = await openContext(browser, 'desktop', false);
  await context.tracing.start({ screenshots: false, snapshots: false });
  await context.addInitScript(instrumentPage, {
    seed: SEED,
    dir: 'ltr',
    readySelector: config.ready,
    removeComposer: false,
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(
    storyUrl(base, scene, { layout: 'desktop', dir: 'ltr', reduced: false }),
  );
  const replay = page.getByRole('button', { name: 'Replay', exact: true });
  const cycles = [];
  for (let index = 0; index < CYCLES; index++) {
    if (index > 0) await replay.click();
    const mounted = await waitFor(page, 'mounts', index, 60000);
    let playbackStart = mounted;
    if (config.ready)
      playbackStart = await waitFor(
        page,
        'readies',
        index,
        config.durationMs,
      ).catch(() => mounted);
    if (mode === 'complete') {
      await waitUntil(page, mounted + config.durationMs + 300);
    } else {
      await waitUntil(page, playbackStart + config.playbackMs.desktop / 2);
      await pointerDown(page);
      await page.waitForTimeout(500);
    }
    cycles.push({ index, ...(await page.evaluate(sample)) });
  }
  const lastMount = await page.evaluate(() => window.__baseline.mounts.at(-1));
  await waitUntil(page, lastMount + config.durationMs + 500);
  const final = await page.evaluate(sample);
  const resources = await heapAndDetached(cdp);
  const result = { scene, mode, cycles, final, resources, seed: SEED };
  await writeFile(
    resolve(directory, 'cycles.json'),
    JSON.stringify(result, null, 2),
  );
  await context.tracing.stop({ path: resolve(directory, 'trace.zip') });
  await context.close();
  return result;
};

const matrixFor = (scene) => {
  const cells = [];
  for (const viewport of Object.keys(VIEWPORTS))
    for (const dir of ['ltr', 'rtl'])
      for (const reduced of [false, true])
        cells.push({
          scene,
          id: `${viewport}-${dir}-${reduced ? 'reduced' : 'motion'}`,
          viewport,
          dir,
          reduced,
        });
  const base = { scene, dir: 'ltr', reduced: false };
  cells.push({
    ...base,
    id: 'desktop-ltr-cancel-half',
    viewport: 'desktop',
    cancel: 'half',
  });
  if (SCENES[scene].readsAnchors)
    for (const viewport of ['desktop', 'mobile390'])
      cells.push({
        ...base,
        id: `${viewport}-ltr-missing-composer`,
        viewport,
        removeComposer: true,
      });
  if (scene === 'gift-wrapping') {
    cells.push({
      ...base,
      id: 'desktop-ltr-cancel-load',
      viewport: 'desktop',
      cancel: 'load',
    });
    cells.push({
      ...base,
      id: 'desktop-ltr-slow-4g',
      viewport: 'desktop',
      network: 'slow-4g',
    });
  }
  if (scene === 'cat')
    cells.push({
      ...base,
      id: 'desktop-ltr-cancel-prepare',
      viewport: 'desktop',
      cancel: 'prepare',
    });
  return cells;
};

const mergeResults = async (key, value) => {
  await mkdir(output, { recursive: true });
  const file = resolve(output, 'results.json');
  const previous = existsSync(file)
    ? JSON.parse(await readFile(file, 'utf8'))
    : {};
  await writeFile(file, JSON.stringify({ ...previous, [key]: value }, null, 2));
};

/* Each scene records its own provenance, so a partial rerun cannot relabel
   older scene results with newer environment metadata. */
const withBrowser = async (run) => {
  const { server, base } = await startServer();
  const browser = await chromium.launch();
  try {
    const environment = {
      captureId,
      revision,
      dirty: fingerprint !== null,
      fingerprint,
      storybookIndexMtime: statSync(
        resolve(storybook, 'index.json'),
      ).mtime.toISOString(),
      browser: `chromium ${browser.version()}`,
      os: `${platform()} ${release()} ${arch()}`,
      cpu: cpus()[0]?.model ?? 'unknown',
      cpuCount: cpus().length,
      node: process.version,
      seed: SEED,
      startedAt: new Date().toISOString(),
    };
    return await run(browser, base, environment);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
};

test('the static Storybook exposes the three baseline stories', async () => {
  const index = JSON.parse(
    await readFile(resolve(storybook, 'index.json'), 'utf8'),
  );
  for (const { story } of Object.values(SCENES))
    assert.ok(index.entries[story], `missing story ${story}`);
});

test(
  'the same seed reproduces the sleigh element counts at every capture point',
  { timeout: 120_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const cell = {
        scene: 'sleigh',
        id: 'determinism',
        viewport: 'desktop',
        dir: 'ltr',
        reduced: false,
      };
      const counts = [];
      for (let run = 0; run < 2; run++) {
        const result = await runCell(browser, base, cell, 'metrics');
        /* `end` sits exactly on the provider deadline and may see the layer
           on either side of it; `end+500` is the cleanup sample. */
        counts.push(
          result.samples
            .filter(({ label }) => label !== 'end')
            .map(({ label, layerElements }) => [label, layerElements]),
        );
      }
      assert.deepEqual(counts[0], counts[1]);
    });
  },
);

for (const scene of Object.keys(SCENES))
  test(
    `${scene} baseline: matrix, cancellation and ${CYCLES}+${CYCLES} cycles`,
    { timeout: 3_600_000 },
    async () => {
      await withBrowser(async (browser, base, environment) => {
        const cells = {};
        for (const cell of matrixFor(scene)) {
          cells[cell.id] = {
            metrics: await runCell(browser, base, cell, 'metrics'),
            frames: await runCell(browser, base, cell, 'frames'),
          };
          const { metrics } = cells[cell.id];
          assert.equal(metrics.samples[0].label, 'activation');
          if (scene === 'gift-wrapping' && cell.reduced)
            assert.deepEqual(
              metrics.requests.lottie,
              [],
              `${cell.id} requested the player under reduced motion`,
            );
          if (cell.cancel === 'load')
            assert.deepEqual(
              metrics.timing.rendererInsertsAfterMountMs,
              [],
              'a cancelled load must not insert a renderer',
            );
        }
        const cycles = {
          complete: await runCycles(browser, base, scene, 'complete'),
          cancel: await runCycles(browser, base, scene, 'cancel'),
        };
        await mergeResults(scene, {
          environment: { ...environment, finishedAt: new Date().toISOString() },
          cells: Object.fromEntries(
            Object.entries(cells).map(([id, { metrics }]) => [id, metrics]),
          ),
          cycles,
        });
      });
    },
  );
