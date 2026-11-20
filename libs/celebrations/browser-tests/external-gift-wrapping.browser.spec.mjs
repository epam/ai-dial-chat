/*
 * S3 carry-over (#9222, verified in S4 #9223): the published GiftWrapping
 * assets of `new-year-default@1.1.1` through the anchored `LottieScene`, in the
 * `Packs/ExternalGiftWrapping` stories of the static Storybook build.
 *
 * It asserts loading, cancellation, cached-replay and outline-contact
 * behaviour, and saves contact frames for review. The feet on the composer's
 * top edge are reviewed from those frames, not asserted.
 *
 * Run one test from libs/celebrations, e.g.
 * `node --test --test-name-pattern='cached replay' browser-tests/external-gift-wrapping.browser.spec.mjs`.
 * Output: tmp/celebrations-baseline/<captureId>/external-gift-wrapping/.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import {
  captureFrame,
  captureId,
  output,
  revision,
  startServer,
  storybook,
} from './storybook-harness.mjs';

const STORY = 'packs-externalgiftwrapping--on-composer';
const LAYER = '[data-story-scene-layer]';
const DRAFT = 'Wrap the presents before midnight';
const PLAYBACK_MS = 16000;
/* Beats of the 16 s story: wrap, pull, cocoon reveal, departure. */
const FRAME_OFFSETS_MS = [1800, 4500, 8700, 13300, 15400];
const directory = resolve(output, 'external-gift-wrapping');

const VIEWPORTS = {
  360: {
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
  },
  390: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  },
  1280: {
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
  1920: {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  },
};

/* Runs before any Storybook script: records when a renderer enters the layer. */
const instrument = () => {
  window.__stage = { inserts: [] };
  new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes)
        if (
          node instanceof Element &&
          node.closest('[data-story-scene-layer]') &&
          (node.tagName === 'svg' || node.querySelector('svg'))
        )
          window.__stage.inserts.push(performance.now());
  }).observe(document, { childList: true, subtree: true });
};

const withBrowser = async (run) => {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch();
    return await run(browser, base);
  } finally {
    await browser?.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
};

const open = async (browser, base, width, args = {}) => {
  const isMobile = VIEWPORTS[width].isMobile;
  const query = Object.entries({ isMobile, ...args })
    .map(([key, value]) =>
      typeof value === 'boolean' ? `${key}:!${value}` : `${key}:${value}`,
    )
    .join(';');
  const context = await browser.newContext(VIEWPORTS[width]);
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.goto(
    `${base}/iframe.html?id=${STORY}&viewMode=story&args=${query}`,
  );
  await page.locator(LAYER).waitFor({ state: 'attached' });
  return { context, page, cdp };
};

const countIn = (page, selector) =>
  page.evaluate(
    ([layer, inner]) =>
      document.querySelector(layer)?.querySelectorAll(inner).length ?? 0,
    [LAYER, selector],
  );

const waitForStage = async (page, index = 0, timeout = 5000) => {
  await page.waitForFunction(
    (count) => window.__stage.inserts.length > count,
    index,
    { timeout, polling: 'raf' },
  );
  return page.evaluate((at) => window.__stage.inserts[at], index);
};

const waitUntil = async (page, pageTime) => {
  const now = await page.evaluate(() => performance.now());
  if (pageTime > now) await page.waitForTimeout(pageTime - now);
};

/* Draft, focus and rectangle of the composer, which no outcome may change. */
const composerState = (page) =>
  page.evaluate(() => {
    const composer = document.querySelector('.story-composer');
    const rect = composer?.getBoundingClientRect();
    return {
      draft: document.querySelector('textarea[aria-label="Message"]')?.value,
      activeElement: document.activeElement?.outerHTML.slice(0, 80) ?? null,
      rect: rect && [rect.left, rect.top, rect.width, rect.height],
    };
  });

/*
 * Whether a rendered path traces the composer: every edge of its geometry box
 * lies inside the composer border, inset by at most 4 CSS px (the outline
 * adapter insets by 3 stage units at a scale of 0.6–1).
 */
const outlineInsets = (page) =>
  page.evaluate((layer) => {
    const composer = document
      .querySelector('.story-composer')
      ?.getBoundingClientRect();
    if (!composer) return null;
    let best = null;
    for (const path of document.querySelectorAll(`${layer} svg path`)) {
      const box = path.getBoundingClientRect();
      if (box.width < composer.width / 2) continue;
      const insets = [
        box.left - composer.left,
        box.top - composer.top,
        composer.right - box.right,
        composer.bottom - box.bottom,
      ];
      const worst = Math.max(...insets.map((inset) => Math.abs(inset - 2)));
      if (!best || worst < best.worst) best = { insets, worst };
    }
    return best;
  }, LAYER);

const tracesComposer = (match) =>
  Boolean(match) && match.insets.every((inset) => inset >= -1 && inset <= 4.5);

/* Samples the outline every 250 ms until it traces the composer or time runs out. */
const waitForOutline = async (page, stageAt, untilMs = PLAYBACK_MS) => {
  let last = null;
  for (let offset = 0; offset <= untilMs; offset += 250) {
    await waitUntil(page, stageAt + offset);
    last = await outlineInsets(page);
    if (tracesComposer(last)) return { offsetMs: offset, ...last };
  }
  return { offsetMs: null, ...last };
};

/* Listener counts on window and document, through CDP. */
const listenerCount = async (cdp) => {
  let total = 0;
  for (const expression of ['window', 'document']) {
    const { result } = await cdp.send('Runtime.evaluate', { expression });
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', {
      objectId: result.objectId,
    });
    total += listeners.length;
  }
  return total;
};

test('external gift-wrapping: the static Storybook exposes the stories', async () => {
  const index = JSON.parse(
    await readFile(resolve(storybook, 'index.json'), 'utf8'),
  );
  for (const id of [
    STORY,
    'packs-externalgiftwrapping--mobile',
    'packs-externalgiftwrapping--rtl-mirror',
    'packs-externalgiftwrapping--stage-anchor-fallback',
  ])
    assert.ok(index.entries[id], `missing story ${id}`);
});

for (const [name, loader, timeout] of [
  ['a slow load', 'slow', 3500],
  ['a broken load', 'broken', 2000],
])
  test(
    `external gift-wrapping: ${name} shows the poster and inserts no renderer`,
    { timeout: 60_000 },
    async () => {
      await withBrowser(async (browser, base) => {
        const { page } = await open(browser, base, 1280, { loader });
        await page
          .locator(`${LAYER} img`)
          .waitFor({ state: 'attached', timeout });
        assert.equal(await countIn(page, 'svg'), 0);
        assert.deepEqual(await page.evaluate(() => window.__stage.inserts), []);
      });
    },
  );

test(
  'external gift-wrapping: a cancellation during loading renders nothing',
  { timeout: 60_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const { page } = await open(browser, base, 1280, { loader: 'slow' });
      await page.waitForTimeout(300);
      await page.keyboard.press('Shift');
      /* Past the 4 s slow loader and the 2 s deadline: neither may revive it. */
      await page.waitForTimeout(4500);
      assert.equal(await countIn(page, 'svg, img'), 0);
      assert.deepEqual(await page.evaluate(() => window.__stage.inserts), []);
    });
  },
);

test(
  'external gift-wrapping: a cancellation during playback releases the scene and keeps the composer',
  { timeout: 90_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const { page, cdp } = await open(browser, base, 1280);
      const counts = [];
      for (const [run, cancelAtMs] of [
        [0, 6000],
        [1, 1000],
      ]) {
        if (run > 0) await page.getByRole('button', { name: 'Replay' }).click();
        const stageAt = await waitForStage(page, run);
        await waitUntil(page, stageAt + cancelAtMs);
        const before = await composerState(page);
        await page.keyboard.press('Shift');
        await page.waitForFunction(
          (layer) => !document.querySelector(layer)?.querySelector('svg, img'),
          LAYER,
          { timeout: 500 },
        );
        await page.waitForTimeout(300);
        const after = await composerState(page);
        assert.equal(after.draft, DRAFT);
        assert.deepEqual(after, before);
        assert.equal(await countIn(page, '[data-celebration-anchor]'), 0);
        counts.push(await listenerCount(cdp));
      }
      assert.equal(
        counts[1],
        counts[0],
        `listeners accumulated across activations: ${counts.join(' → ')}`,
      );
    });
  },
);

test(
  'external gift-wrapping: a cached replay requests the data once and follows each composer width',
  { timeout: 90_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const { page } = await open(browser, base, 1280);
      const widths = [];
      for (const [run, viewportWidth] of [
        [0, 1280],
        [1, 520],
      ]) {
        if (run > 0) {
          await page.keyboard.press('Shift');
          await page.setViewportSize({ width: viewportWidth, height: 800 });
          await page.getByRole('button', { name: 'Replay' }).click();
        }
        const stageAt = await waitForStage(page, run);
        const match = await waitForOutline(page, stageAt);
        assert.ok(
          match.offsetMs !== null,
          `run ${run}: no rendered path traced the composer (best insets ${JSON.stringify(match.insets)})`,
        );
        widths.push(
          await page.evaluate(
            () =>
              document.querySelector('.story-composer').getBoundingClientRect()
                .width,
          ),
        );
      }
      assert.notEqual(
        widths[0],
        widths[1],
        'the composer width did not change',
      );
      assert.equal(
        await page.getByText(/Data requests: \d+/).textContent(),
        'Data requests: 1',
      );
      await page.getByRole('button', { name: 'Check cache' }).click();
      await page.getByText('Cache pristine: yes').waitFor();
    });
  },
);

const CELLS = [
  ...[360, 390, 1280, 1920].flatMap((width) =>
    ['ltr', 'rtl'].map((dir) => ({ id: `${width}-${dir}`, width, dir })),
  ),
  { id: '1280-ltr-stage-anchor', width: 1280, dir: 'ltr', hasComposer: false },
  { id: '390-ltr-stage-anchor', width: 390, dir: 'ltr', hasComposer: false },
];

test(
  'external gift-wrapping: contact frames at every width and direction, and without a composer',
  { timeout: 900_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const summary = { captureId, revision, cells: {} };
      for (const cell of CELLS) {
        const hasComposer = cell.hasComposer ?? true;
        const { context, page, cdp } = await open(browser, base, cell.width, {
          dir: cell.dir,
          hasComposer,
        });
        const cellDirectory = resolve(directory, cell.id);
        await mkdir(cellDirectory, { recursive: true });
        const stageAt = await waitForStage(page);
        const anchor = await page
          .locator('[data-celebration-anchor]')
          .getAttribute('data-celebration-anchor');
        assert.equal(anchor, hasComposer ? 'composer' : 'stage-anchor');
        const frames = [];
        let outline = null;
        for (const offset of FRAME_OFFSETS_MS) {
          await waitUntil(page, stageAt + offset);
          assert.ok(
            (await countIn(page, 'svg')) > 0,
            `${cell.id}: the scene ended before ${offset} ms`,
          );
          const file = `${String(offset).padStart(5, '0')}ms.png`;
          await captureFrame(cdp, resolve(cellDirectory, file));
          const insets = hasComposer ? await outlineInsets(page) : null;
          if (tracesComposer(insets) && !outline)
            outline = { offsetMs: offset, ...insets };
          frames.push({ offsetMs: offset, file, insets });
        }
        if (hasComposer)
          assert.ok(
            outline,
            `${cell.id}: no captured frame shows the outline tracing the composer`,
          );
        summary.cells[cell.id] = { anchor, outline, frames };
        await context.close();
      }
      await writeFile(
        resolve(directory, 'contact-frames.json'),
        JSON.stringify(summary, null, 2),
      );
    });
  },
);

/*
 * Preparation timing (spec "Anchored preparation time is measured under CPU
 * throttling"): the `Packs/PreparationBenchmark` story times the internal
 * preparation 20 times on the live composer. The 50 ms target is reported,
 * never asserted, so a regression shows up as a recorded finding.
 */
const BENCHMARK_TARGET_MS = 50;

test(
  'external gift-wrapping: preparation timing under 4x CPU throttling',
  { timeout: 120_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const results = { captureId, revision, targetMs: BENCHMARK_TARGET_MS };
      for (const width of [1280, 390]) {
        const isMobile = VIEWPORTS[width].isMobile;
        const context = await browser.newContext(VIEWPORTS[width]);
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        const story = isMobile ? 'mobile' : 'default';
        await page.goto(
          `${base}/iframe.html?id=packs-preparationbenchmark--${story}&viewMode=story`,
        );
        const run = page.getByRole('button', { name: 'Run benchmark' });
        await run.waitFor();
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await run.click();
        const output = page.getByRole('status', { name: 'Benchmark results' });
        await page.waitForFunction(
          () =>
            document.querySelector('output[aria-label="Benchmark results"]')
              ?.textContent,
          undefined,
          { timeout: 60_000 },
        );
        const cases = JSON.parse(await output.textContent());
        for (const result of cases)
          if (result.p95Ms > BENCHMARK_TARGET_MS)
            console.warn(
              `finding: ${result.id} at ${width} px has p95 ${result.p95Ms.toFixed(1)} ms > ${BENCHMARK_TARGET_MS} ms`,
            );
        results[width] = cases;
        await context.close();
      }
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, 'preparation.json'),
        JSON.stringify(results, null, 2),
      );
    });
  },
);
