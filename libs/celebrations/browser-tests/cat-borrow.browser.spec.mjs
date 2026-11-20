/*
 * S4 (#9223): the cat-borrow adapter through the real `LottieScene` on the
 * real `ConversationInput` (`Packs/CatBorrowSpike`).
 *
 * The spike tests (design D9) measure the gate rows (contact error,
 * landing-to-recoil alignment, resilience to a long task, rendering cost
 * against the compiled Cat) and save contact frames and normal-speed
 * recordings for review. They assert the harness invariants, the contact
 * threshold (also right after the long task) and the recoil alignment across
 * drops; the rendering cost is recorded, not asserted. Every number is written
 * to tmp/celebrations-baseline/<captureId>/cat-borrow-spike/.
 *
 * The full-scene tests (task 6.1) play the 25 s asset: every story at every
 * width and direction, the load and readiness failures, cancellation at each
 * phase, a cached replay and reduced motion. They assert contact, the story
 * each page can play, and that every outcome leaves the page as it was; their
 * numbers and contact frames go to .../cat-borrow-full/.
 *
 * Every rendering-cost run detects each scene's own start (the renderer SVG
 * for cat-borrow, the actor for the compiled Cat) and samples both scenes for
 * the same window from that start; a missing start fails the test.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import {
  captureFrame,
  captureId,
  heapAndDetached,
  output,
  percentile,
  revision,
  startServer,
  storybook,
  waitUntil,
} from './storybook-harness.mjs';

const SPIKE = 'packs-catborrowspike';
const COMPILED = 'halloween-scenes--cat';
const LAYER = '[data-story-scene-layer]';
/* The compiled Cat's scene element and its actor, which mounts when it starts. */
const COMPILED_SCENE = '[data-halloween-scene="cat"]';
const FPS = 60;
const CONTACT_THRESHOLD_PX = 2;
/* The sampled frame used for a contact must lie this close to the contact instant. */
const CONTACT_WINDOW_MS = 40;
/* One frame, rounded up, for comparing timeline offsets. */
const ONE_FRAME_MS = 17;
const directory = resolve(output, 'cat-borrow-spike');

const fixture = JSON.parse(
  await readFile(
    resolve(
      import.meta.dirname,
      '../src/stories/fixtures/cat-borrow-spike.lottie.json',
    ),
    'utf8',
  ),
);
const markerMs = (name) =>
  fixture.markers
    .filter(({ cm }) => cm === name)
    .map(({ tm }) => (tm / FPS) * 1000);
const CONTACTS_MS = markerMs('cat:contact:0');
const [RELEASE_MS] = markerMs('cat:release:0');
const PLAYBACK_MS = (fixture.op / FPS) * 1000;

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

/*
 * Runs before any Storybook script: renderer inserts, compiled-Cat starts,
 * per-frame paw/copy samples and long tasks. `inserts` counts only the Lottie
 * renderer's SVG: the borrowed copies carry icon SVGs of their own, inside
 * `[data-cat-borrow-copies]` / `[data-celebration-snapshot]`.
 */
const instrument = () => {
  const state = {
    inserts: [],
    compiledStarts: [],
    samples: [],
    longTasks: [],
    frames: [],
    recording: false,
  };
  window.__spike = state;
  const isRenderer = (svg) =>
    svg.closest('[data-story-scene-layer]') &&
    !svg.closest('[data-cat-borrow-copies], [data-celebration-snapshot]') &&
    !svg.parentElement?.closest('svg');
  new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        const svgs =
          node.tagName === 'svg' ? [node] : [...node.querySelectorAll('svg')];
        if (svgs.some(isRenderer)) state.inserts.push(performance.now());
        if (
          node.matches('[data-cat-actor]') ||
          node.querySelector('[data-cat-actor]')
        )
          state.compiledStarts.push(performance.now());
      }
  }).observe(document, { childList: true, subtree: true });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        state.longTasks.push({
          start: entry.startTime,
          duration: entry.duration,
        });
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    state.longTasksUnsupported = true;
  }
  const rect = (element) => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return {
      left: box.left,
      top: box.top,
      right: box.right,
      bottom: box.bottom,
    };
  };
  /* Sampled in a task after the frame, once every rAF callback (lottie's
     render included) has run, so paw and copy come from the same frame. */
  /* The top-level layer group holding the paw: the cat-rig precomposition. */
  const catGroup = (paw) => {
    let node = paw;
    while (
      node?.parentNode &&
      node.parentNode.parentNode !== paw.ownerSVGElement
    )
      node = node.parentNode;
    return node?.parentNode ? node : null;
  };
  const sample = () => {
    const pawElement = document.getElementById('cat-paw');
    const paw = pawElement?.getBoundingClientRect();
    state.samples.push({
      cat: pawElement ? rect(catGroup(pawElement)) : null,
      t: document.timeline.currentTime,
      paw: paw && { x: paw.left + paw.width / 2, y: paw.top + paw.height / 2 },
      copy: rect(document.querySelector('[data-cat-prize="0"]')),
      copy1: rect(document.querySelector('[data-cat-prize="1"]')),
    });
  };
  const tick = (time) => {
    state.frames.push(time);
    if (state.recording) setTimeout(sample, 0);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
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

/* A failed CDP measurement must fail the check, never compare `null` with `null`. */
const assertMeasured = (result, label) => {
  assert.equal(result.heapError, undefined, `${label}: ${result.heapError}`);
  assert.equal(
    result.detachedError,
    undefined,
    `${label}: ${result.detachedError}`,
  );
  assert.equal(typeof result.heapUsedBytes, 'number', `${label}: no heap`);
  assert.equal(
    typeof result.detachedSvgNodes,
    'number',
    `${label}: no detached-node count`,
  );
};

const query = (args) =>
  Object.entries(args)
    .map(([key, value]) =>
      typeof value === 'boolean' ? `${key}:!${value}` : `${key}:${value}`,
    )
    .join(';');

const open = async (
  browser,
  base,
  width,
  {
    story = `${SPIKE}--desktop`,
    args = {},
    height,
    video,
    contextOptions = {},
    initScripts = [],
    onPage,
  } = {},
) => {
  const preset = VIEWPORTS[width];
  const context = await browser.newContext({
    ...preset,
    ...contextOptions,
    viewport: { width, height: height ?? preset.viewport.height },
    ...(video
      ? {
          recordVideo: {
            dir: video,
            size: { width, height: height ?? preset.viewport.height },
          },
        }
      : {}),
  });
  await context.addInitScript(instrument);
  for (const script of initScripts) await context.addInitScript(script);
  const page = await context.newPage();
  onPage?.(page);
  const cdp = await context.newCDPSession(page);
  const all = story.startsWith(SPIKE)
    ? { isMobile: preset.isMobile, ...args }
    : args;
  await page.goto(
    `${base}/iframe.html?id=${story}&viewMode=story&args=${query(all)}`,
  );
  return { context, page, cdp };
};

const waitForStage = async (page, index = 0) => {
  await page.waitForFunction(
    (count) => window.__spike.inserts.length > count,
    index,
    {
      timeout: 8000,
      polling: 'raf',
    },
  );
  return page.evaluate((at) => window.__spike.inserts[at], index);
};

/* The copy's animation start is the Lottie frame-0 time on the document timeline. */
const frameZero = (page) =>
  page
    .waitForFunction(
      () =>
        document.querySelector('[data-cat-prize="0"]')?.getAnimations()[0]
          ?.startTime ?? null,
      undefined,
      { timeout: 8000, polling: 'raf' },
    )
    .then((handle) => handle.jsonValue());

const waitUntilTimeline = async (page, time) => {
  const now = await page.evaluate(() => document.timeline.currentTime);
  if (time > now) await page.waitForTimeout(time - now);
};

/* The sample nearest `target` among those `accept` keeps, or `null`. */
const nearestSample = (samples, target, accept = () => true) =>
  samples
    .filter(accept)
    .reduce(
      (best, entry) =>
        !best || Math.abs(entry.t - target) < Math.abs(best.t - target)
          ? entry
          : best,
      null,
    );

/* Horizontal distance from the paw to the copy's near edge. */
const edgeError = (paw, copy) => {
  const nearEdge =
    paw.x <= (copy.left + copy.right) / 2 ? copy.left : copy.right;
  return Number(Math.abs(paw.x - nearEdge).toFixed(2));
};

/*
 * Paw against the `key` copy's near edge at the sampled frame nearest each
 * contact. A contact with no sampled frame within CONTACT_WINDOW_MS has no
 * error (`null`), which the callers treat as a failure.
 */
const contactErrorsAt = (samples, zero, contactsMs, key) =>
  contactsMs.map((ms) => {
    const target = zero + ms;
    const sample = nearestSample(
      samples,
      target,
      (entry) => entry.paw && entry[key],
    );
    if (!sample || Math.abs(sample.t - target) > CONTACT_WINDOW_MS)
      return { ms, error: null };
    const { paw } = sample;
    const copy = sample[key];
    return {
      ms,
      frameOffsetMs: Number((sample.t - target).toFixed(1)),
      error: edgeError(paw, copy),
      insideHeight: paw.y >= copy.top - 0.5 && paw.y <= copy.bottom + 0.5,
    };
  });

const CONTACT_CELLS = [360, 390, 1280, 1920].flatMap((width) =>
  ['ltr', 'rtl'].flatMap((dir) =>
    ['real', '56'].map((buttonHeight) => ({
      id: `${width}-${dir}-${buttonHeight}`,
      width,
      dir,
      buttonHeight,
    })),
  ),
);

test('cat-borrow spike: the fixture declares the contact and release markers the checks read', () => {
  assert.ok(CONTACTS_MS.length >= 3, 'fewer than three cat:contact:0 markers');
  assert.equal(typeof RELEASE_MS, 'number', 'no cat:release:0 marker');
});

test('cat-borrow spike: the static Storybook exposes the spike and compiled stories', async () => {
  const index = JSON.parse(
    await readFile(resolve(storybook, 'index.json'), 'utf8'),
  );
  for (const id of [
    `${SPIKE}--desktop`,
    `${SPIKE}--mobile`,
    `${SPIKE}--on-support`,
    COMPILED,
  ])
    assert.ok(index.entries[id], `missing story ${id}`);
});

test(
  'cat-borrow spike: paw contact at every contact marker across 16 cells',
  { timeout: 900_000 },
  async () => {
    assert.ok(CONTACTS_MS.length > 0, 'the fixture has no contact markers');
    await withBrowser(async (browser, base) => {
      const cells = {};
      for (const cell of CONTACT_CELLS) {
        const { context, page, cdp } = await open(browser, base, cell.width, {
          args: { dir: cell.dir, buttonHeight: cell.buttonHeight },
        });
        const cellDirectory = resolve(directory, 'contacts', cell.id);
        await mkdir(cellDirectory, { recursive: true });
        await waitForStage(page);
        await page.evaluate(() => {
          window.__spike.recording = true;
        });
        const zero = await frameZero(page);
        for (const ms of CONTACTS_MS) {
          await waitUntilTimeline(page, zero + ms);
          await captureFrame(
            cdp,
            resolve(
              cellDirectory,
              `${String(Math.round(ms)).padStart(5, '0')}ms.png`,
            ),
          );
        }
        await waitUntilTimeline(page, zero + RELEASE_MS + 300);
        const samples = await page.evaluate(() => window.__spike.samples);
        const errors = contactErrorsAt(samples, zero, CONTACTS_MS, 'copy');
        cells[cell.id] = {
          errors,
          maxErrorPx: Math.max(...errors.map(({ error }) => error ?? Infinity)),
        };
        await context.close();
      }
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, 'contacts.json'),
        JSON.stringify(
          { captureId, revision, thresholdPx: CONTACT_THRESHOLD_PX, cells },
          null,
          2,
        ),
      );
      for (const [id, { errors, maxErrorPx }] of Object.entries(cells)) {
        assert.ok(
          errors.every(({ insideHeight }) => insideHeight),
          `${id}: the paw left the copy's height`,
        );
        assert.ok(
          maxErrorPx <= CONTACT_THRESHOLD_PX,
          `${id}: contact error ${maxErrorPx} px > ${CONTACT_THRESHOLD_PX} px`,
        );
      }
    });
  },
);

/*
 * Landing = the first sample where the last copy stops going down (its
 * bounce), or else its lowest point. Drop = the copy's bottom at the landing
 * minus its bottom at the release.
 */
const findLanding = (samples) => {
  const withCopy = samples.filter(({ copy, paw }) => copy && paw);
  assert.ok(withCopy.length > 2, 'no paw and copy were sampled together');
  const lowest = Math.max(...withCopy.map(({ copy }) => copy.bottom));
  let index = withCopy.findIndex(
    ({ copy }, i) =>
      i > 0 &&
      i < withCopy.length - 1 &&
      copy.bottom > withCopy[i - 1].copy.bottom + 0.1 &&
      withCopy[i + 1].copy.bottom < copy.bottom - 0.1,
  );
  if (index < 0)
    index = withCopy.findIndex(({ copy }) => copy.bottom >= lowest - 0.5);
  return withCopy[index];
};

const STILL_FRAMES = 3;
const RECOIL_SEARCH_MS = 300;
const PAW_MOVE_PX = 0.5;
/* The release itself moves the paw; the rest search starts this long after it. */
const RELEASE_SETTLE_MS = 50;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/*
 * Recoil onset. Within ±RECOIL_SEARCH_MS of the landing (and after the
 * release), the paw's rest is the run of STILL_FRAMES frames with the least
 * motion; the onset is the first later frame where the paw has left that rest
 * by more than PAW_MOVE_PX. Searching both sides of the landing lets an early
 * recoil show up as an onset before the expected one; a paw that never rests
 * (less than PAW_MOVE_PX per frame) has no onset.
 */
const findRecoilOnset = (samples, landingT, releaseT) => {
  const withPaw = samples.filter(({ paw }) => paw);
  const from = Math.max(
    landingT - RECOIL_SEARCH_MS,
    releaseT + RELEASE_SETTLE_MS,
  );
  const to = landingT + RECOIL_SEARCH_MS;
  const step = (index) => distance(withPaw[index].paw, withPaw[index - 1].paw);
  let rest = -1;
  let restMotion = Infinity;
  for (let i = 1; i + STILL_FRAMES - 1 < withPaw.length; i++) {
    if (withPaw[i].t < from) continue;
    if (withPaw[i + STILL_FRAMES - 1].t > to) break;
    let motion = 0;
    for (let j = i; j < i + STILL_FRAMES; j++) motion += step(j);
    if (motion < restMotion) {
      rest = i;
      restMotion = motion;
    }
  }
  if (rest < 0 || restMotion > STILL_FRAMES * PAW_MOVE_PX) return null;
  const anchor = withPaw[rest].paw;
  return (
    withPaw
      .slice(rest + 1)
      .find(({ t, paw }) => t <= to && distance(paw, anchor) > PAW_MOVE_PX) ??
    null
  );
};

/* Gravity of the copies' fall, `COPY_GRAVITY_PX_PER_S2` in `lottie-track-keyframes.ts`. */
const COPY_GRAVITY_PX_PER_S2 = 2000;
const [SPIKE_LANDING] = fixture.markers.filter(
  ({ cm }) => cm === 'cat:landing:0',
);
const AUTHORED_FALL_MS = (SPIKE_LANDING.tm / FPS) * 1000 - RELEASE_MS;
const ELASTIC_MS = (SPIKE_LANDING.dr / FPS) * 1000;

/*
 * Speed of the elastic piece after the landing (design D6): the authored
 * reaction plays at `E / (E − (f_p − f_a))`, so its onset after the landing
 * scales by the inverse of that speed.
 */
const elasticSpeed = (dropPx) => {
  const physicalFallMs =
    Math.sqrt((2 * dropPx) / COPY_GRAVITY_PX_PER_S2) * 1000;
  return ELASTIC_MS / (ELASTIC_MS - (physicalFallMs - AUTHORED_FALL_MS));
};

/* Landing time, drop and signed recoil delay of the last copy, relative to `zero`. */
const measureLanding = (samples, zero, releaseMs) => {
  const landing = findLanding(samples);
  const atRelease = nearestSample(
    samples,
    zero + releaseMs,
    ({ copy }) => copy,
  );
  const onset = findRecoilOnset(samples, landing.t, zero + releaseMs);
  return {
    landingMs: Number((landing.t - zero).toFixed(1)),
    dropPx: atRelease
      ? Number((landing.copy.bottom - atRelease.copy.bottom).toFixed(1))
      : null,
    recoilDelayMs: onset ? Number((onset.t - landing.t).toFixed(1)) : null,
  };
};

test(
  'cat-borrow spike: the recoil follows the physical landing for different drops',
  { timeout: 300_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const cases = [
        {
          id: 'reference-drop',
          width: 1280,
          height: 800,
          story: `${SPIKE}--desktop`,
        },
        {
          id: 'support-drop',
          width: 1280,
          height: 800,
          story: `${SPIKE}--on-support`,
        },
        {
          id: 'long-drop',
          width: 1280,
          height: 1100,
          story: `${SPIKE}--desktop`,
        },
      ];
      const results = {};
      for (const entry of cases) {
        const { context, page } = await open(browser, base, entry.width, {
          story: entry.story,
          height: entry.height,
        });
        await waitForStage(page);
        await page.evaluate(() => {
          window.__spike.recording = true;
        });
        const zero = await frameZero(page);
        await waitUntilTimeline(page, zero + PLAYBACK_MS - 200);
        const samples = await page.evaluate(() => window.__spike.samples);
        results[entry.id] = measureLanding(samples, zero, RELEASE_MS);
        await context.close();
      }
      /*
       * The reference fixes the authored reaction offset; every drop must start
       * its recoil within one frame of that offset at its own elastic speed.
       */
      const reference = results['reference-drop'];
      const authoredOffsetMs =
        reference.recoilDelayMs === null || reference.dropPx === null
          ? null
          : reference.recoilDelayMs * elasticSpeed(reference.dropPx);
      for (const value of Object.values(results)) {
        value.elasticSpeed =
          value.dropPx === null
            ? null
            : Number(elasticSpeed(value.dropPx).toFixed(3));
        value.expectedDelayMs =
          authoredOffsetMs === null || value.elasticSpeed === null
            ? null
            : Number((authoredOffsetMs / value.elasticSpeed).toFixed(1));
        value.alignmentErrorMs =
          value.recoilDelayMs === null || value.expectedDelayMs === null
            ? null
            : Number(
                Math.abs(value.recoilDelayMs - value.expectedDelayMs).toFixed(
                  1,
                ),
              );
      }
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, 'landing.json'),
        JSON.stringify(
          { captureId, revision, toleranceMs: ONE_FRAME_MS, results },
          null,
          2,
        ),
      );
      for (const [id, value] of Object.entries(results)) {
        assert.ok(
          value.recoilDelayMs !== null,
          `${id}: no recoil onset was found`,
        );
        assert.ok(
          value.dropPx > 0,
          `${id}: the copy did not drop (${value.dropPx} px)`,
        );
        assert.ok(
          value.alignmentErrorMs <= ONE_FRAME_MS,
          `${id}: recoil ${value.recoilDelayMs} ms after the landing, expected ${value.expectedDelayMs} ms`,
        );
      }
    });
  },
);

test(
  'cat-borrow spike: contact survives a 200 ms long task under 4x CPU throttling',
  { timeout: 120_000 },
  async () => {
    assert.ok(CONTACTS_MS.length >= 3, 'the fixture has no push contact');
    await withBrowser(async (browser, base) => {
      const { context, page, cdp } = await open(browser, base, 1280);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await waitForStage(page);
      await page.evaluate(() => {
        window.__spike.recording = true;
      });
      const zero = await frameZero(page);
      /* The third contact starts the push. */
      const [, , pushContact] = CONTACTS_MS;
      await waitUntilTimeline(page, zero + pushContact + 200);
      const blockedAt = await page.evaluate(() => {
        const start = document.timeline.currentTime;
        const until = performance.now() + 200;
        while (performance.now() < until);
        return start;
      });
      await page.waitForTimeout(300);
      const samples = await page.evaluate(() => window.__spike.samples);
      const errors = samples
        .filter(({ t, paw, copy }) => t > blockedAt + 150 && paw && copy)
        .slice(0, 3)
        .map(({ paw, copy }) => edgeError(paw, copy));
      await waitUntilTimeline(page, zero + PLAYBACK_MS - 200);
      const all = await page.evaluate(() => window.__spike.samples);
      const result = {
        firstFramesAfterTaskErrorPx: errors,
        landingMs: measureLanding(all, zero, RELEASE_MS).landingMs,
      };
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, 'long-task.json'),
        JSON.stringify({ captureId, revision, result }, null, 2),
      );
      await context.close();
      assert.ok(errors.length > 0, 'no frame rendered after the long task');
      assert.ok(
        Math.max(...errors) <= CONTACT_THRESHOLD_PX,
        `contact error after the long task: ${errors.join(', ')} px`,
      );
    });
  },
);

/* Waits for the compiled Cat to start: its actor (or crossing fallback) mounts. */
const waitForCompiledStart = async (page) => {
  await page.waitForFunction(
    () => window.__spike.compiledStarts.length > 0,
    undefined,
    { timeout: 8000, polling: 'raf' },
  );
  return page.evaluate(() => window.__spike.compiledStarts[0]);
};

/*
 * Frame times and long tasks over `sampleMs` from the scene's own start, SVG
 * elements in the scene mid-playback, then heap and detached SVG after 1 and
 * 20 runs. A scene whose start is not detected fails the check.
 */
const playbackCost = async (browser, base, width, story, sampleMs = 6000) => {
  const isCompiled = story === COMPILED;
  const { context, page, cdp } = await open(browser, base, width, {
    story,
    args: isCompiled ? { isMobile: VIEWPORTS[width].isMobile } : {},
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const start = isCompiled
    ? await waitForCompiledStart(page)
    : await waitForStage(page);
  await waitUntil(page, start + sampleMs / 2);
  const svgElements = await page.evaluate(
    (selector) =>
      document.querySelector(selector)?.querySelectorAll('svg, svg *').length ??
      null,
    isCompiled ? COMPILED_SCENE : LAYER,
  );
  assert.ok(svgElements > 0, `${story}: no SVG in the scene mid-playback`);
  await waitUntil(page, start + sampleMs);
  const stats = await page.evaluate(
    ({ from, to }) => {
      const { frames, longTasks, longTasksUnsupported } = window.__spike;
      const inside = frames.filter((time) => time >= from && time <= to);
      const deltas = inside.slice(1).map((time, index) => time - inside[index]);
      return {
        deltas,
        longTasks: longTasksUnsupported
          ? null
          : longTasks.filter(({ start }) => start >= from && start <= to),
      };
    },
    { from: start, to: start + sampleMs },
  );
  await page.keyboard.press('Shift');
  await page.waitForTimeout(1000);
  const first = await heapAndDetached(cdp);
  for (let run = 0; run < 20; run++) {
    await page.getByRole('button', { name: 'Replay' }).click();
    await page.waitForTimeout(150 + (run % 5) * 120);
  }
  await page.keyboard.press('Shift');
  await page.waitForTimeout(1000);
  const resources = await heapAndDetached(cdp);
  await context.close();
  assertMeasured(first, `${story} after 1 run`);
  assertMeasured(resources, `${story} after 20 runs`);
  return {
    sampleWindowMs: sampleMs,
    p50FrameMs: percentile(stats.deltas, 0.5),
    p95FrameMs: percentile(stats.deltas, 0.95),
    longTaskCount: stats.longTasks?.length ?? null,
    longestTaskMs: stats.longTasks?.length
      ? Math.max(...stats.longTasks.map(({ duration }) => duration))
      : 0,
    svgElementsMidPlayback: svgElements,
    heapAfter1RunBytes: first.heapUsedBytes,
    heapAfter20RunsBytes: resources.heapUsedBytes,
    heapGrowthBytes: resources.heapUsedBytes - first.heapUsedBytes,
    detachedSvgNodesAfter1Run: first.detachedSvgNodes,
    detachedSvgNodesAfter20Runs: resources.detachedSvgNodes,
  };
};

test(
  'cat-borrow spike: rendering cost against the compiled Cat under 4x CPU throttling',
  { timeout: 300_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const results = {};
      for (const width of [1280, 390]) {
        results[width] = {
          spike: await playbackCost(
            browser,
            base,
            width,
            `${SPIKE}--${width < 1280 ? 'mobile' : 'desktop'}`,
          ),
          compiled: await playbackCost(browser, base, width, COMPILED),
        };
      }
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, 'cost.json'),
        JSON.stringify({ captureId, revision, results }, null, 2),
      );
    });
  },
);

test(
  'cat-borrow spike: normal-speed recordings',
  { timeout: 300_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      for (const [width, story] of [
        [1280, `${SPIKE}--desktop`],
        [390, `${SPIKE}--mobile`],
        [1280, `${SPIKE}--rtl`],
        [1280, `${SPIKE}--on-support`],
      ]) {
        const video = resolve(
          directory,
          'videos',
          `${width}-${story.split('--')[1]}`,
        );
        await mkdir(video, { recursive: true });
        const { context, page } = await open(browser, base, width, {
          story,
          video,
        });
        await waitForStage(page);
        await page.waitForTimeout(PLAYBACK_MS + 500);
        await context.close();
      }
    });
  },
);

/*
 * Preparation timing of the whole cat-borrow adapter on the real composer
 * (design D9, spec "Readiness"): the spike clip and the shipped full asset on
 * the two-button page. The 50 ms target is reported, never asserted.
 */
const CAT_BENCHMARK_CASES = [
  'cat-borrow:cat-borrow-spike',
  'cat-borrow:cat-borrow-full',
];
test(
  'cat-borrow spike: preparation timing under 4x CPU throttling',
  { timeout: 120_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const results = { captureId, revision, targetMs: 50 };
      for (const width of [1280, 390]) {
        const { context, page, cdp } = await open(browser, base, width, {
          story: `packs-preparationbenchmark--${width < 1280 ? 'cat-mobile' : 'cat'}`,
        });
        const run = page.getByRole('button', { name: 'Run benchmark' });
        await run.waitFor();
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await run.click();
        await page.waitForFunction(
          () =>
            document.querySelector('output[aria-label="Benchmark results"]')
              ?.textContent,
          undefined,
          { timeout: 60_000 },
        );
        const cases = JSON.parse(
          await page
            .getByRole('status', { name: 'Benchmark results' })
            .textContent(),
        );
        assert.deepEqual(
          cases.map(({ id }) => id),
          CAT_BENCHMARK_CASES,
          `${width} px: the benchmark did not time both assets`,
        );
        for (const result of cases)
          if (result.p95Ms > results.targetMs)
            console.warn(
              `finding: ${result.id} at ${width} px has p95 ${result.p95Ms.toFixed(1)} ms > ${results.targetMs} ms`,
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

/* ---------- Full scene (task 6.1) ---------- */

const fullDirectory = resolve(output, 'cat-borrow-full');
const DRAFT = 'Keep this draft exactly as it is';
const full = JSON.parse(
  await readFile(
    resolve(
      import.meta.dirname,
      '../src/stories/fixtures/cat-borrow-full.lottie.json',
    ),
    'utf8',
  ),
);
const TWO_PRIZES = full.markers.find(
  ({ cm }) => cm === 'cat:section:two-prizes',
);
/*
 * Both the two-button story and the one-button story (which leaves at
 * `cat:branch:one-prize`, after the first release) play the two-prize section
 * from frame 0 at authored speed until `cat:landing:1`, so every contact in
 * it is at `frame / fps` after frame zero.
 */
const twoPrizeMs = (name) =>
  full.markers
    .filter(
      ({ cm, tm }) =>
        cm === name &&
        tm >= TWO_PRIZES.tm &&
        tm < TWO_PRIZES.tm + TWO_PRIZES.dr,
    )
    .map(({ tm }) => (tm / full.fr) * 1000);
const FULL_CONTACTS_MS = {
  0: twoPrizeMs('cat:contact:0'),
  1: twoPrizeMs('cat:contact:1'),
};
const [FULL_RELEASE_0_MS] = twoPrizeMs('cat:release:0');
const COPY_KEY = { 0: 'copy', 1: 'copy1' };
const MOVE_BIND = full.markers.find(({ cm }) => cm === 'cat:bind:move');
const MOVE_MS = [MOVE_BIND.tm, MOVE_BIND.tm + MOVE_BIND.dr].map(
  (frame) => (frame / full.fr) * 1000,
);

/*
 * Facing during the walk between the buttons (design, "The cat walks
 * backwards"): the pushing paw leads, so it lies on the walking side of the
 * cat's center.
 */
const walkFacing = (samples, zero) => {
  const walk = samples.filter(
    ({ t, paw, cat }) =>
      paw && cat && t >= zero + MOVE_MS[0] && t <= zero + MOVE_MS[1],
  );
  if (walk.length < 2) return null;
  const direction = Math.sign(walk.at(-1).paw.x - walk[0].paw.x);
  const facing = walk.map(({ paw, cat }) =>
    Math.sign(paw.x - (cat.left + cat.right) / 2),
  );
  return {
    direction,
    samples: walk.length,
    facingShare: Number(
      (
        facing.filter((sign) => sign === direction).length / walk.length
      ).toFixed(2),
    ),
  };
};

const FULL_STORY = {
  two: `${SPIKE}--full-two-buttons`,
  one: `${SPIKE}--full-one-button`,
  crossing: `${SPIKE}--full-crossing`,
};

/* Paw against a copy's near edge at the sampled frame nearest each contact. */
const fullContactErrors = (samples, zero, prize) =>
  contactErrorsAt(samples, zero, FULL_CONTACTS_MS[prize], COPY_KEY[prize]);

/* Opacity, inline style and rectangle of every page button, plus the draft. */
const pageState = (page) =>
  page.evaluate(() => ({
    buttons: [...document.querySelectorAll('main button')].map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        opacity: getComputedStyle(button).opacity,
        style: button.getAttribute('style'),
        rect: [rect.left, rect.top, rect.width, rect.height].map(
          (value) => Math.round(value * 10) / 10,
        ),
      };
    }),
    draft: document.querySelector('main textarea')?.value,
  }));

/* Leftovers of a scene: copies, animations on originals, renderer or poster. */
const leftovers = (page) =>
  page.evaluate((layer) => {
    const buttons = [...document.querySelectorAll('main button')];
    return {
      snapshots: document.querySelectorAll('[data-celebration-snapshot]')
        .length,
      animatedOriginals: buttons.filter(
        (button) => button.getAnimations().length,
      ).length,
      rendered: document.querySelector(layer)?.querySelectorAll('svg').length,
    };
  }, LAYER);

const assertRestored = async (page, before, label) => {
  const left = await leftovers(page);
  assert.deepEqual(
    { snapshots: left.snapshots, animatedOriginals: left.animatedOriginals },
    { snapshots: 0, animatedOriginals: 0 },
    `${label}: the scene left copies or animations behind`,
  );
  const after = await pageState(page);
  assert.equal(after.draft, DRAFT, `${label}: the draft changed`);
  assert.deepEqual(
    after.buttons.map(({ opacity, style }) => ({ opacity, style })),
    before.buttons.map(({ opacity, style }) => ({ opacity, style })),
    `${label}: an original kept a changed opacity or style`,
  );
};

/* Opens a full story and returns the page state before any copy exists. */
const openFull = async (browser, base, width, story, options = {}) => {
  const opened = await open(browser, base, width, { story, ...options });
  if (story.startsWith(SPIKE)) {
    await opened.page.locator(LAYER).waitFor({ state: 'attached' });
    await opened.page.locator('main textarea').waitFor();
  }
  return { ...opened, before: await pageState(opened.page) };
};

const waitForSceneEnd = (page, timeout = 30_000) =>
  page.waitForFunction(
    (layer) => !document.querySelector(layer)?.querySelector('svg, img'),
    LAYER,
    { timeout, polling: 250 },
  );

test('cat-borrow full: the fixture declares the contact and release markers the checks read', () => {
  assert.ok(
    FULL_CONTACTS_MS[0].length >= 3,
    'fewer than three cat:contact:0 markers in two-prizes',
  );
  assert.ok(
    FULL_CONTACTS_MS[1].length > 0,
    'no cat:contact:1 marker in two-prizes',
  );
  assert.equal(typeof FULL_RELEASE_0_MS, 'number', 'no cat:release:0 marker');
});

test('cat-borrow full: the static Storybook exposes the full-asset stories', async () => {
  const index = JSON.parse(
    await readFile(resolve(storybook, 'index.json'), 'utf8'),
  );
  for (const id of Object.values(FULL_STORY))
    assert.ok(index.entries[id], `missing story ${id}`);
});

const STORY_CELLS = Object.keys(FULL_STORY).flatMap((story) =>
  [360, 390, 1280, 1920].flatMap((width) =>
    ['ltr', 'rtl'].map((dir) => ({
      id: `${story}-${width}-${dir}`,
      story,
      width,
      dir,
    })),
  ),
);

test(
  'cat-borrow full: every story at every width and direction keeps contact and restores the page',
  { timeout: 2_400_000 },
  async () => {
    assert.ok(
      FULL_CONTACTS_MS[0].length > 0 && FULL_CONTACTS_MS[1].length > 0,
      'the fixture has no contact markers',
    );
    await withBrowser(async (browser, base) => {
      const cells = {};
      for (const cell of STORY_CELLS) {
        const { context, page, cdp, before } = await openFull(
          browser,
          base,
          cell.width,
          FULL_STORY[cell.story],
          { args: { dir: cell.dir } },
        );
        const frames = resolve(fullDirectory, 'contacts', cell.id);
        await mkdir(frames, { recursive: true });
        await waitForStage(page);
        await page.evaluate(() => {
          window.__spike.recording = true;
        });
        const result = { prizes: [], contacts: {} };
        if (cell.story !== 'crossing') {
          const zero = await frameZero(page);
          const contacts = [0, 1]
            .flatMap((prize) =>
              FULL_CONTACTS_MS[prize].map((ms) => ({ prize, ms })),
            )
            .sort((a, b) => a.ms - b.ms);
          for (const { prize, ms } of contacts) {
            await waitUntilTimeline(page, zero + ms);
            const isPresent = await page.evaluate(
              (index) =>
                Boolean(document.querySelector(`[data-cat-prize="${index}"]`)),
              prize,
            );
            if (isPresent)
              await captureFrame(
                cdp,
                resolve(
                  frames,
                  `prize-${prize}-${String(Math.round(ms)).padStart(5, '0')}ms.png`,
                ),
              );
          }
          await page.waitForTimeout(300);
          const samples = await page.evaluate(() => window.__spike.samples);
          for (const prize of [0, 1]) {
            if (!samples.some((entry) => entry[COPY_KEY[prize]])) continue;
            result.prizes.push(prize);
            result.contacts[prize] = fullContactErrors(samples, zero, prize);
          }
          if (result.prizes.length === 2) {
            const center = (key) => {
              const first = samples.find((entry) => entry[key])[key];
              return (first.left + first.right) / 2;
            };
            result.order =
              Math.sign(center('copy1') - center('copy')) > 0
                ? 'left-to-right'
                : 'right-to-left';
            result.walk = walkFacing(samples, zero);
          }
        }
        await waitForSceneEnd(page);
        await page.waitForTimeout(300);
        const samples = await page.evaluate(() => window.__spike.samples);
        const paws = samples.filter(({ paw }) => paw).map(({ paw }) => paw.x);
        result.pawTravelPx = paws.length
          ? Number((Math.max(...paws) - Math.min(...paws)).toFixed(1))
          : 0;
        result.copiesSeen = samples.some(({ copy, copy1 }) => copy || copy1);
        await assertRestored(page, before, cell.id);
        cells[cell.id] = result;
        await context.close();
      }
      await mkdir(fullDirectory, { recursive: true });
      await writeFile(
        resolve(fullDirectory, 'stories.json'),
        JSON.stringify(
          { captureId, revision, thresholdPx: CONTACT_THRESHOLD_PX, cells },
          null,
          2,
        ),
      );
      for (const cell of STORY_CELLS) {
        const result = cells[cell.id];
        if (cell.story === 'crossing') {
          assert.equal(
            result.copiesSeen,
            false,
            `${cell.id}: a button was borrowed`,
          );
          assert.ok(
            result.pawTravelPx >= cell.width / 2,
            `${cell.id}: the cat did not cross (${result.pawTravelPx} px)`,
          );
          continue;
        }
        assert.ok(
          result.prizes.includes(0),
          `${cell.id}: no button was borrowed`,
        );
        if (cell.story === 'one')
          assert.deepEqual(
            result.prizes,
            [0],
            `${cell.id}: a second button was borrowed`,
          );
        for (const prize of result.prizes)
          for (const { ms, error, insideHeight } of result.contacts[prize]) {
            assert.ok(
              error !== null,
              `${cell.id}: no frame near prize ${prize} contact at ${ms} ms`,
            );
            assert.ok(
              insideHeight,
              `${cell.id}: the paw left prize ${prize}'s height at ${ms} ms`,
            );
            assert.ok(
              error <= CONTACT_THRESHOLD_PX,
              `${cell.id}: prize ${prize} contact error ${error} px at ${ms} ms`,
            );
          }
      }
      for (const [id, { walk }] of Object.entries(cells))
        if (walk)
          assert.ok(
            walk.facingShare >= 0.9,
            `${id}: the cat faced away from its walk between the buttons (${JSON.stringify(walk)})`,
          );
      const orders = new Set(
        Object.values(cells)
          .map(({ order }) => order)
          .filter(Boolean),
      );
      assert.deepEqual(
        [...orders].sort(),
        ['left-to-right', 'right-to-left'],
        'the two-button story did not run in both button orders',
      );
    });
  },
);

/*
 * Holds lottie's `DOMLoaded` (a zero-delay timer queued right after the
 * renderer appends its SVG) for 1 s, past the scene's 250 ms readiness
 * deadline: a slow renderer initialization the browser cannot otherwise
 * produce on demand.
 */
const delayRendererReady = () => {
  const append = Element.prototype.appendChild;
  const schedule = window.setTimeout;
  let isArmed = false;
  Element.prototype.appendChild = function appendChild(node) {
    const result = append.call(this, node);
    if (
      node instanceof SVGSVGElement &&
      this.closest?.('[data-story-scene-layer]')
    )
      isArmed = true;
    return result;
  };
  window.setTimeout = function setTimeout(handler, delay, ...rest) {
    if (isArmed && !delay) {
      isArmed = false;
      window.__readyDelayed = true;
      return schedule.call(this, handler, 1000, ...rest);
    }
    return schedule.call(this, handler, delay, ...rest);
  };
};

for (const [name, options, timeout] of [
  ['a slow load', { args: { loader: 'slow' } }, 3500],
  ['a broken load', { args: { loader: 'broken' } }, 2000],
  ['a readiness timeout', { initScripts: [delayRendererReady] }, 3000],
])
  test(
    `cat-borrow full: ${name} shows the poster and borrows nothing`,
    { timeout: 60_000 },
    async () => {
      await withBrowser(async (browser, base) => {
        const { page, before } = await openFull(
          browser,
          base,
          1280,
          FULL_STORY.two,
          options,
        );
        await page
          .locator(`${LAYER} img`)
          .waitFor({ state: 'attached', timeout });
        if (name === 'a readiness timeout')
          assert.equal(
            await page.evaluate(() => window.__readyDelayed),
            true,
            'the renderer readiness was never delayed',
          );
        assert.equal((await leftovers(page)).rendered, 0);
        await assertRestored(page, before, name);
      });
    },
  );

/* Waits for the last copy's rebound: it rises again after its lowest point. */
const waitForRebound = (page) =>
  page.waitForFunction(
    () => {
      const tracked = window.__spike.samples.filter(({ copy1 }) => copy1);
      let lowest = -Infinity;
      for (const { copy1 } of tracked) {
        if (copy1.bottom > lowest) lowest = copy1.bottom;
        else if (copy1.bottom < lowest - 2) return true;
      }
      return false;
    },
    undefined,
    { timeout: 30_000, polling: 'raf' },
  );

/* The copy's left edge at the sampled frame nearest `target`. */
const copyLeftAt = (samples, target, key = 'copy') =>
  nearestSample(samples, target, (entry) => entry[key])?.[key].left;

for (const [phase, reach] of [
  [
    'mid-push',
    /* Halfway between the push contact and the release, while the copy slides. */
    async (page, zero) => {
      const pushMs = FULL_CONTACTS_MS[0][2];
      await waitUntilTimeline(page, zero + (pushMs + FULL_RELEASE_0_MS) / 2);
      const samples = await page.evaluate(() => window.__spike.samples);
      const now = await page.evaluate(() => document.timeline.currentTime);
      const moved = Math.abs(
        copyLeftAt(samples, now) - copyLeftAt(samples, zero + pushMs),
      );
      assert.ok(moved > 0.5, `the copy was not being pushed (${moved} px)`);
    },
  ],
  [
    'after the release',
    (page, zero) => waitUntilTimeline(page, zero + FULL_RELEASE_0_MS + 150),
  ],
  ['during the rebound', (page) => waitForRebound(page)],
])
  test(
    `cat-borrow full: a cancellation ${phase} restores the page`,
    { timeout: 90_000 },
    async () => {
      assert.ok(FULL_CONTACTS_MS[0].length >= 3, 'no push contact');
      await withBrowser(async (browser, base) => {
        const { page, before } = await openFull(
          browser,
          base,
          1280,
          FULL_STORY.two,
        );
        await waitForStage(page);
        await page.evaluate(() => {
          window.__spike.recording = true;
        });
        await reach(page, await frameZero(page));
        const rects = (await pageState(page)).buttons.map(({ rect }) => rect);
        await page.keyboard.press('Shift');
        await waitForSceneEnd(page, 500);
        await page.waitForTimeout(300);
        assert.deepEqual(
          (await pageState(page)).buttons.map(({ rect }) => rect),
          rects,
          `${phase}: an original moved`,
        );
        await assertRestored(page, before, phase);
      });
    },
  );

test(
  'cat-borrow full: a cancellation during loading renders nothing and restores the page',
  { timeout: 60_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const { page, before } = await openFull(
        browser,
        base,
        1280,
        FULL_STORY.two,
      );
      /* The 150 ms story loader is still pending: no renderer exists yet. */
      assert.deepEqual(
        await page.evaluate(() => window.__spike.inserts),
        [],
        'the renderer was inserted before the cancellation',
      );
      await page.keyboard.press('Shift');
      await page.waitForTimeout(1500);
      assert.deepEqual(await page.evaluate(() => window.__spike.inserts), []);
      assert.equal(
        await page.evaluate(
          (layer) =>
            document.querySelector(layer)?.querySelectorAll('svg, img').length,
          LAYER,
        ),
        0,
      );
      await assertRestored(page, before, 'during loading');
    });
  },
);

/*
 * From the moment lottie appends its SVG to the scene layer, holds every
 * `requestAnimationFrame` callback until `__releaseFrames()`, so the session
 * reaches `play()` (DOMLoaded is a zero-delay timer) but never renders its
 * first frame. Counts WAAPI animations started on copies or page buttons.
 */
const holdFirstFrame = () => {
  const nativeFrame = window.requestAnimationFrame.bind(window);
  const nativeAnimate = Element.prototype.animate;
  const append = Element.prototype.appendChild;
  const held = [];
  const hold = { isHolding: false, isArmed: false, held: 0, animations: 0 };
  window.__frameHold = hold;
  Element.prototype.appendChild = function appendChild(node) {
    const result = append.call(this, node);
    if (
      !hold.isArmed &&
      node instanceof SVGSVGElement &&
      this.closest?.('[data-story-scene-layer]') &&
      !this.closest('[data-cat-borrow-copies], [data-celebration-snapshot]')
    ) {
      hold.isArmed = true;
      hold.isHolding = true;
    }
    return result;
  };
  window.requestAnimationFrame = (callback) => {
    if (!hold.isHolding) return nativeFrame(callback);
    held.push(callback);
    hold.held = held.length;
    return -held.length;
  };
  Element.prototype.animate = function animate(...args) {
    if (this.matches?.('[data-celebration-snapshot], main button'))
      hold.animations += 1;
    return nativeAnimate.apply(this, args);
  };
  window.__releaseFrames = () => {
    hold.isHolding = false;
    held.splice(0).forEach((callback) => nativeFrame(callback));
  };
};

test(
  'cat-borrow full: a cancellation after play() but before the first rendered frame starts nothing and restores the page',
  { timeout: 60_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const { page, before } = await openFull(
        browser,
        base,
        1280,
        FULL_STORY.two,
        { initScripts: [holdFirstFrame] },
      );
      await page.waitForFunction(
        () => window.__frameHold.isHolding,
        undefined,
        {
          timeout: 8000,
        },
      );
      /* DOMLoaded and play() run on timers, not frames: let the session reach play(). */
      await page.waitForTimeout(300);
      const held = await page.evaluate(
        (layer) => ({
          ...window.__frameHold,
          copies: document.querySelectorAll('[data-celebration-snapshot]')
            .length,
          hasPoster: Boolean(document.querySelector(`${layer} img`)),
        }),
        LAYER,
      );
      assert.ok(held.held > 0, 'no animation frame was requested');
      assert.ok(held.copies > 0, 'the copies were not attached');
      assert.equal(held.hasPoster, false, 'the scene failed before play()');
      assert.equal(held.animations, 0, 'a copy or original started early');
      await page.keyboard.press('Shift');
      await waitForSceneEnd(page, 500);
      await page.evaluate(() => window.__releaseFrames());
      await page.waitForTimeout(500);
      assert.equal(
        await page.evaluate(() => window.__frameHold.animations),
        0,
        'a copy or original animation started after the cancellation',
      );
      assert.equal((await leftovers(page)).rendered, 0);
      await assertRestored(page, before, 'before the first rendered frame');
    });
  },
);

test(
  'cat-borrow full: a cached replay requests the data once and keeps contact',
  { timeout: 120_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const { page, before } = await openFull(
        browser,
        base,
        1280,
        FULL_STORY.two,
      );
      const errors = [];
      for (const run of [0, 1]) {
        if (run > 0) await page.getByRole('button', { name: 'Replay' }).click();
        await waitForStage(page, run);
        await page.evaluate(() => {
          window.__spike.recording = true;
        });
        const zero = await frameZero(page);
        await waitUntilTimeline(page, zero + FULL_RELEASE_0_MS + 100);
        const samples = await page.evaluate(
          (from) => window.__spike.samples.filter(({ t }) => t >= from),
          zero,
        );
        errors.push(fullContactErrors(samples, zero, 0));
        await page.keyboard.press('Shift');
        await waitForSceneEnd(page, 500);
      }
      for (const [run, contacts] of errors.entries())
        for (const { ms, error } of contacts)
          assert.ok(
            error !== null && error <= CONTACT_THRESHOLD_PX,
            `run ${run}: contact error ${error} px at ${ms} ms`,
          );
      assert.equal(
        await page.getByText(/Data requests: \d+/).textContent(),
        'Data requests: 1',
      );
      await page.getByRole('button', { name: 'Check cache' }).click();
      await page.getByText('Cache pristine: yes').waitFor();
      await assertRestored(page, before, 'cached replay');
    });
  },
);

test(
  'cat-borrow full: reduced motion shows the poster without requesting data or the player',
  { timeout: 60_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const requests = [];
      const { page, before } = await openFull(
        browser,
        base,
        1280,
        FULL_STORY.two,
        {
          contextOptions: { reducedMotion: 'reduce' },
          onPage: (opened) =>
            opened.on('request', (request) => requests.push(request.url())),
        },
      );
      await page
        .locator(`${LAYER} img`)
        .waitFor({ state: 'attached', timeout: 2000 });
      await page.waitForTimeout(1000);
      assert.deepEqual(await page.evaluate(() => window.__spike.inserts), []);
      assert.equal(
        await page.getByText(/Data requests: \d+/).textContent(),
        'Data requests: 0',
      );
      assert.deepEqual(
        requests.filter((url) => /lottie_light/.test(url)),
        [],
        'the player was requested',
      );
      await assertRestored(page, before, 'reduced motion');
    });
  },
);

/* ---------- Resource retention (task 6.2) ---------- */

/* Counts pending timeouts and intervals the page has scheduled. */
const timerShim = () => {
  const timeouts = new Set();
  const intervals = new Set();
  const native = {
    setTimeout: window.setTimeout,
    clearTimeout: window.clearTimeout,
    setInterval: window.setInterval,
    clearInterval: window.clearInterval,
  };
  window.setTimeout = function setTimeout(handler, delay, ...rest) {
    if (typeof handler !== 'function')
      return native.setTimeout.call(window, handler, delay, ...rest);
    const id = native.setTimeout.call(
      window,
      function fire(...args) {
        timeouts.delete(id);
        return handler.apply(this, args);
      },
      delay,
      ...rest,
    );
    timeouts.add(id);
    return id;
  };
  window.setInterval = function setInterval(handler, delay, ...rest) {
    const id = native.setInterval.call(window, handler, delay, ...rest);
    intervals.add(id);
    return id;
  };
  /* Browsers let either clear function cancel either kind of timer. */
  const clear = (id) => {
    timeouts.delete(id);
    intervals.delete(id);
  };
  window.clearTimeout = (id) => {
    clear(id);
    return native.clearTimeout.call(window, id);
  };
  window.clearInterval = (id) => {
    clear(id);
    return native.clearInterval.call(window, id);
  };
  window.__timers = () => ({
    timeouts: timeouts.size,
    intervals: intervals.size,
  });
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

/*
 * Interruption points after each Replay. The data is cached after the first
 * activation, so the 50 ms point lands in the cached load, preparation or
 * renderer setup rather than a network wait. The others follow the renderer
 * insert: the first frame, the walk-in, mid-push of the first copy, its fall
 * and the last copy's rebound (the compiled Cat, which has no copies to watch,
 * cancels at the same story time). Run 20 completes, so restoration by
 * completion is covered too.
 */
const RETENTION_PHASES = [
  { name: 'cached load and preparation', afterClickMs: 50 },
  { name: 'first frame', afterStageMs: 0 },
  { name: 'walk-in', afterStageMs: 1500 },
  { name: 'mid-push', afterStageMs: 12_600 },
  { name: 'fall', afterStageMs: 13_500 },
  { name: 'rebound', afterStageMs: 20_500, isRebound: true },
];
const RETENTION_RUNS = 20;
/* The compiled Cat runs HALLOWEEN_CAT_SCENE_DURATION_MS (25 s) + 500 ms. */
const COMPILED_CAT_MS = 26_000;

const settle = async (page, cdp) => {
  /* Past every restore fade and poster. */
  await page.waitForTimeout(1500);
  return {
    listeners: await listenerCount(cdp),
    timers: await page.evaluate(() => window.__timers()),
    rendered: (await leftovers(page)).rendered,
    ...(await heapAndDetached(cdp)),
  };
};

/*
 * One activation, then 20 more interrupted at varied phases; returns the
 * measurements and the phase of each run. The compiled Cat's cycle waits for
 * its actor to mount and otherwise by time; it only provides the heap
 * reference.
 */
const retentionCycle = async (browser, base, story) => {
  const isCatBorrow = story.startsWith(SPIKE);
  const { context, page, cdp, before } = await openFull(
    browser,
    base,
    1280,
    story,
    {
      initScripts: [timerShim],
    },
  );
  const replay = page.getByRole('button', { name: 'Replay' });
  const starts = () =>
    page.evaluate(
      (key) => window.__spike[key].length,
      isCatBorrow ? 'inserts' : 'compiledStarts',
    );
  const reachStage = (count) =>
    isCatBorrow
      ? waitForStage(page, count)
      : page.waitForFunction(
          (index) => window.__spike.compiledStarts.length > index,
          count,
          { timeout: 8000, polling: 'raf' },
        );
  const end = (timeout) =>
    isCatBorrow ? waitForSceneEnd(page, timeout) : page.waitForTimeout(500);
  const setRecording = (isRecording) =>
    page.evaluate((value) => {
      window.__spike.samples = [];
      window.__spike.recording = value;
    }, isRecording);
  await reachStage(0);
  await page.keyboard.press('Shift');
  await end(2000);
  const first = await settle(page, cdp);
  const phases = [];
  for (let run = 1; run <= RETENTION_RUNS; run++) {
    const count = await starts();
    const phase = RETENTION_PHASES[(run - 1) % RETENTION_PHASES.length];
    const isWatchingRebound = isCatBorrow && phase.isRebound;
    if (isWatchingRebound) await setRecording(true);
    await replay.click();
    if (run === RETENTION_RUNS) {
      /* The last run completes: wait for its stage before waiting for its end. */
      await reachStage(count);
      phases.push('completed');
      break;
    }
    if (phase.afterClickMs !== undefined)
      await page.waitForTimeout(phase.afterClickMs);
    else {
      await reachStage(count);
      if (isWatchingRebound) await waitForRebound(page);
      else await page.waitForTimeout(phase.afterStageMs);
    }
    await page.keyboard.press('Shift');
    if (isWatchingRebound) await setRecording(false);
    phases.push(phase.name);
    await end(2000);
  }
  if (isCatBorrow) await waitForSceneEnd(page, 30_000);
  else await page.waitForTimeout(COMPILED_CAT_MS);
  const last = await settle(page, cdp);
  if (isCatBorrow) await assertRestored(page, before, `${story} retention`);
  await context.close();
  assertMeasured(first, `${story} after the first activation`);
  assertMeasured(last, `${story} after ${RETENTION_RUNS} activations`);
  return { phases, first, last };
};

test(
  'cat-borrow full: 20 interrupted activations leave no copy, listener, timer, renderer node or heap growth',
  { timeout: 600_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const scene = await retentionCycle(browser, base, FULL_STORY.two);
      const compiled = await retentionCycle(browser, base, COMPILED);
      const growth = ({ first, last }) =>
        last.heapUsedBytes - first.heapUsedBytes;
      const result = {
        captureId,
        revision,
        runs: RETENTION_RUNS,
        phases: RETENTION_PHASES,
        scene,
        compiled,
        sceneHeapGrowthBytes: growth(scene),
        compiledHeapGrowthBytes: growth(compiled),
        allowanceBytes: growth(compiled) + 1024 * 1024,
      };
      await mkdir(fullDirectory, { recursive: true });
      await writeFile(
        resolve(fullDirectory, 'retention.json'),
        JSON.stringify(result, null, 2),
      );
      const { first, last } = scene;
      assert.equal(
        last.listeners,
        first.listeners,
        'window or document listeners accumulated',
      );
      assert.ok(
        last.timers.timeouts <= first.timers.timeouts &&
          last.timers.intervals <= first.timers.intervals,
        `timers accumulated: ${JSON.stringify(first.timers)} → ${JSON.stringify(last.timers)}`,
      );
      assert.equal(last.rendered, 0, 'a renderer SVG remained in the stage');
      assert.ok(
        last.detachedSvgNodes <= first.detachedSvgNodes,
        `detached SVG nodes grew from ${first.detachedSvgNodes} to ${last.detachedSvgNodes}`,
      );
      assert.ok(
        result.sceneHeapGrowthBytes <= result.allowanceBytes,
        `heap grew ${result.sceneHeapGrowthBytes} B > ${result.allowanceBytes} B`,
      );
    });
  },
);

/* Rendering cost of the whole 25 s scene against the compiled Cat (task 6.4). */
test(
  'cat-borrow full: rendering cost against the compiled Cat under 4x CPU throttling',
  { timeout: 600_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const results = {};
      for (const width of [1280, 390]) {
        results[width] = {
          full: await playbackCost(
            browser,
            base,
            width,
            FULL_STORY.two,
            24_000,
          ),
          compiled: await playbackCost(browser, base, width, COMPILED, 24_000),
        };
      }
      await mkdir(fullDirectory, { recursive: true });
      await writeFile(
        resolve(fullDirectory, 'cost.json'),
        JSON.stringify({ captureId, revision, results }, null, 2),
      );
    });
  },
);

/* Normal-speed recordings for review (task 6.3): every story, layout and direction, and the compiled Cat for parity. */
test(
  'cat-borrow full: normal-speed recordings',
  { timeout: 1_200_000 },
  async () => {
    await withBrowser(async (browser, base) => {
      const clips = [
        ...Object.entries(FULL_STORY).flatMap(([name, story]) =>
          [390, 1280].flatMap((width) =>
            ['ltr', 'rtl'].map((dir) => ({
              id: `${name}-${width}-${dir}`,
              width,
              story,
              args: { dir },
            })),
          ),
        ),
        ...[390, 1280].map((width) => ({
          id: `compiled-${width}`,
          width,
          story: COMPILED,
          args: { isMobile: width < 1280 },
        })),
      ];
      for (const clip of clips) {
        const video = resolve(fullDirectory, 'videos', clip.id);
        await mkdir(video, { recursive: true });
        const { context, page } = await open(browser, base, clip.width, {
          story: clip.story,
          args: clip.args,
          video,
        });
        if (clip.story.startsWith(SPIKE)) {
          await waitForStage(page);
          await waitForSceneEnd(page);
        } else await page.waitForTimeout(COMPILED_CAT_MS);
        await page.waitForTimeout(500);
        await context.close();
      }
    });
  },
);
