/* Run against the celebrations Storybook dev server:
   node libs/celebrations/browser-tests/reindeer-takeoff.browser.spec.mjs
   Captures normal-speed playback; structural budgets are assertions, frame
   timings are measurements on the current machine, not an FPS guarantee. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.STORYBOOK_URL ?? 'http://localhost:6010';
const output = resolve('tmp/reindeer-verification');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const scene = '[data-new-year-scene="reindeer-takeoff"]';
const scenarios = [
  { width: 360, story: 'reindeer-takeoff-mobile', cpu: 4, catch: 'text' },
  {
    width: 900,
    story: 'reindeer-takeoff-rtl',
    cpu: 4,
    args: 'isMobile:true',
    catch: 'text',
  },
  { width: 1280, story: 'reindeer-takeoff-draft', cpu: 1, catch: 'text' },
  { width: 1920, story: 'reindeer-takeoff', cpu: 1, catch: 'text' },
];
try {
  for (const scenario of scenarios.filter(
    ({ width }) =>
      !process.env.REINDEER_WIDTHS ||
      process.env.REINDEER_WIDTHS.split(',').includes(String(width)),
  )) {
    const page = await browser.newPage({
      viewport: { width: scenario.width, height: 900 },
      recordVideo: {
        dir: resolve(output, 'videos'),
        size: { width: scenario.width, height: 900 },
      },
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpu });
    await cdp.send('Performance.enable');
    await page.addInitScript(() => {
      window.reindeerProfile = { frames: [], longTasks: [], reads: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.reindeerProfile.longTasks.push({
            start: entry.startTime,
            duration: entry.duration,
          });
      }).observe({ type: 'longtask', buffered: true });
      const tick = (time) => {
        window.reindeerProfile.frames.push(time);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      const bounds = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function () {
        if (
          window.reindeerPlaybackMeasured &&
          this.matches('.story-composer, .story-add, .story-starters, h1, main')
        )
          window.reindeerProfile.reads++;
        return bounds.call(this);
      };
    });
    await page.goto(
      `${origin}/iframe.html?id=new-year-scenes--${scenario.story}&viewMode=story&args=${scenario.args ?? ''}`,
    );
    await page.locator(`${scene} svg`).waitFor({ timeout: 30000 });
    const initial = await page.evaluate(async (selector) => {
      const { prepareReindeerScene } =
        await import('/src/new-year/utils/reindeer-scene.ts');
      const prepared = prepareReindeerScene(
        {
          composer: 'story-composer',
          composerAddCluster: 'story-add',
          starterList: 'story-starters',
          welcomeRegion: '[role="region"]',
        },
        innerWidth < 1280,
      );
      const { loadLottiePlayer } = await import('/src/utils/lottie-player.ts');
      window.reindeerPlayer = (
        await loadLottiePlayer()
      ).getRegisteredAnimations()[0];
      window.reindeerClip = prepared.targets.bounds;
      const editor = document.querySelector('textarea');
      window.reindeerDraft = {
        value: editor.value,
        placeholder: editor.placeholder,
        style: editor.getAttribute('style'),
      };
      const floor = prepared.targets.composer.rect.top - 2;
      if (Math.abs(prepared.targets.origin[1] - floor) > 0.1)
        throw new Error('Cast is not standing on the input rim');
      const bytes = new TextEncoder().encode(
        JSON.stringify(prepared.animationData),
      ).length;
      const host = document.querySelector(selector);
      window.reindeerProfile.frames = [];
      window.reindeerProfile.longTasks = [];
      window.reindeerPlaybackMeasured = true;
      return {
        started: performance.now(),
        bytes,
        catch: host.dataset.reindeerCatch,
        svgNodes: host.querySelectorAll('svg *').length,
        paths: host.querySelectorAll('svg path').length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        travel: Math.abs(
          prepared.probe(3.6).adult[0] - prepared.probe(0).adult[0],
        ),
      };
    }, scene);
    assert(
      initial.svgNodes <= 320,
      `${scenario.width}: ${initial.svgNodes} SVG nodes`,
    );
    assert(initial.paths <= 140);
    assert(initial.bytes <= 500000);
    assert.equal(initial.overflow, false);
    assert.equal(initial.catch, scenario.catch, 'Expected a real page control');
    const traceEvents = [];
    if (scenario.width === 1280) {
      cdp.on('Tracing.dataCollected', ({ value }) =>
        traceEvents.push(...value),
      );
      await cdp.send('Tracing.start', {
        categories: 'devtools.timeline',
        transferMode: 'ReportEvents',
      });
    }
    const airborne = [];
    for (const seconds of [1.6, 4, 10.2, 12.3, 14.65, 18, 20.2, 21.5, 22.6]) {
      await page.waitForTimeout(
        Math.max(
          0,
          seconds * 1000 -
            (await page.evaluate(
              () =>
                (window.reindeerPlayer.currentFrame /
                  window.reindeerPlayer.frameRate) *
                1000,
            )),
        ),
      );
      await page.screenshot({
        path: resolve(output, `${scenario.width}-${seconds}.png`),
        caret: 'initial',
      });
      if (seconds === 10.2) {
        const prop = await page
          .locator('[data-reindeer-word]')
          .evaluate((el) => {
            const matrix = new DOMMatrix(getComputedStyle(el).transform);
            return {
              distance: Math.abs(matrix.e),
              lift: matrix.f,
              tilt: Math.abs(matrix.b),
            };
          });
        assert(
          prop.distance > 18 && prop.lift < -30 && prop.tilt > 0.1,
          'UI prop must visibly react to tension',
        );
      }
      if (seconds === 20.2 || seconds === 22.6) {
        const wake = await page.evaluate(() => {
          const layer = window.reindeerPlayer.renderer.elements.find(
            (el) => el.data.nm === 'snow-wake',
          ).layerElement;
          return [...layer.querySelectorAll('g')].filter(
            (el) => Number(el.getAttribute('opacity')) > 0.05,
          ).length;
        });
        assert(
          wake >= 2,
          'Snow must remain along the flight path, including after departure',
        );
      }
      if (seconds === 18 || seconds === 20.2) {
        const cast = await page.evaluate(() =>
          window.reindeerPlayer.renderer.elements
            .filter((el) =>
              ['adult', 'calf', 'gift-sleigh'].includes(el.data.nm),
            )
            .map((el) => {
              const box = el.layerElement.getBoundingClientRect();
              return {
                name: el.data.nm,
                box: box.toJSON(),
                visible:
                  box.width > 20 &&
                  box.height > 20 &&
                  box.left >= window.reindeerClip.left &&
                  box.right <= window.reindeerClip.right &&
                  box.top >= 140 &&
                  box.bottom <= innerHeight,
              };
            }),
        );
        assert.equal(cast.length, 3);
        assert(
          cast.every((item) => item.visible),
          JSON.stringify({ width: scenario.width, seconds, cast }),
        );
        airborne.push({ seconds, cast });
      }
    }
    await page.waitForFunction(
      (selector) => !document.querySelector(selector),
      scene,
      { timeout: 5000 },
    );
    assert.equal(
      await page
        .locator('[data-reindeer-word], [data-reindeer-word-mask]')
        .count(),
      0,
    );
    const profile = await page.evaluate(() => {
      window.reindeerPlaybackMeasured = false;
      const { frames, longTasks, reads } = window.reindeerProfile;
      const intervals = frames
        .slice(1)
        .map((t, i) => t - frames[i])
        .sort((a, b) => a - b);
      return {
        frames: intervals.length,
        p95: intervals[Math.floor(intervals.length * 0.95)],
        p99: intervals[Math.floor(intervals.length * 0.99)],
        maxFrame: intervals.at(-1),
        longTasks,
        reads,
      };
    });
    assert.equal(profile.reads, 0, 'Host measured during playback');
    assert.deepEqual(errors, []);
    assert(
      await page.evaluate(() => {
        const editor = document.querySelector('textarea');
        return (
          editor.value === window.reindeerDraft.value &&
          editor.placeholder === window.reindeerDraft.placeholder &&
          editor.getAttribute('style') === window.reindeerDraft.style
        );
      }),
      'Playback must preserve the native draft, placeholder and styles',
    );
    let paintProfile;
    if (scenario.width === 1280) {
      const complete = new Promise((resolve) =>
        cdp.once('Tracing.tracingComplete', resolve),
      );
      await cdp.send('Tracing.end');
      await complete;
      await writeFile(
        resolve(output, 'desktop-trace.json'),
        JSON.stringify({ traceEvents }),
      );
      paintProfile = Object.fromEntries(
        ['Paint', 'Layout', 'UpdateLayoutTree'].map((name) => [
          name,
          traceEvents
            .filter((e) => e.name === name && e.ph === 'X')
            .reduce((sum, e) => sum + (e.dur ?? 0), 0) / 1000,
        ]),
      );
    }
    const metrics = await cdp.send('Performance.getMetrics');
    /* Inspect native joint transforms after the uninterrupted profiling run.
       The support probe alone cannot detect a renderer/rig mismatch. */
    await page.getByRole('button', { name: 'Replay' }).click();
    await page.locator(`${scene} svg`).waitFor();
    const contact = await page.evaluate(async () => {
      const { prepareReindeerScene } =
        await import('/src/new-year/utils/reindeer-scene.ts');
      const { loadLottiePlayer } = await import('/src/utils/lottie-player.ts');
      const prepared = prepareReindeerScene(
        { composer: 'story-composer', welcomeRegion: '[role="region"]' },
        innerWidth < 1280,
      );
      const player = (await loadLottiePlayer()).getRegisteredAnimations()[0];
      player.pause();
      const soles = player.renderer.elements
        .filter((el) => ['adult', 'calf'].includes(el.data.nm))
        .sort((a, b) => a.data.nm.localeCompare(b.data.nm))
        .flatMap((el) =>
          [...el.layerElement.querySelectorAll('path')].filter(
            (path) => path.getAttribute('fill') === 'rgb(48,43,54)',
          ),
        );
      let maxError = 0,
        maxDrift = 0,
        contacts = 0,
        previous;
      for (let t = 0.5; t <= 16.2; t += 1 / 30) {
        player.goToAndStop(t * player.frameRate, true);
        const expected = prepared.probe(t).hooves;
        const actual = soles.map((sole) =>
          new DOMPoint(0, 56).matrixTransform(sole.getScreenCTM()),
        );
        for (let i = 0; i < actual.length; i++) {
          if (!expected[i].planted) continue;
          contacts++;
          maxError = Math.max(
            maxError,
            Math.hypot(
              actual[i].x - expected[i].point[0],
              actual[i].y - expected[i].point[1],
            ),
          );
          if (
            previous?.expected[i].planted &&
            Math.abs(previous.expected[i].point[0] - expected[i].point[0]) <
              0.001
          )
            maxDrift = Math.max(
              maxDrift,
              Math.abs(actual[i].x - previous.actual[i].x),
            );
        }
        previous = { actual, expected };
      }
      const calf = player.renderer.elements.find((el) => el.data.nm === 'calf');
      const nose = calf.layerElement.querySelector('.reindeer-nose');
      const loop = document.querySelector('.reindeer-loop');
      let maxNoseError = 0;
      let maxGripGap = 0;
      for (let t = 14.2; t <= 14.7; t += 1 / 60) {
        player.goToAndStop(t * player.frameRate, true);
        const actual = new DOMPoint(33, 5).matrixTransform(nose.getScreenCTM());
        const grip = new DOMPoint(0, 0).matrixTransform(loop.getScreenCTM());
        const expected = prepared.probe(t).nose;
        maxNoseError = Math.max(
          maxNoseError,
          Math.hypot(actual.x - expected[0], actual.y - expected[1]),
        );
        maxGripGap = Math.max(
          maxGripGap,
          Math.hypot(actual.x - grip.x, actual.y - grip.y),
        );
      }
      return {
        soles: soles.length,
        contacts,
        maxError,
        maxDrift,
        maxNoseError,
        maxGripGap,
      };
    });
    assert.equal(contact.soles, 8);
    assert(contact.contacts > 2000);
    assert(contact.maxError < 2, JSON.stringify(contact));
    assert(contact.maxDrift < 2.5, JSON.stringify(contact));
    assert(contact.maxNoseError < 1.5, JSON.stringify(contact));
    assert(contact.maxGripGap < 1.5, JSON.stringify(contact));
    results.push({
      ...scenario,
      ...initial,
      ...profile,
      paintProfile,
      airborne,
      contact,
      metrics: metrics.metrics.filter(({ name }) =>
        /^(LayoutDuration|RecalcStyleDuration|ScriptDuration|TaskDuration)$/.test(
          name,
        ),
      ),
    });
    console.log(JSON.stringify(results.at(-1)));
    await writeFile(
      resolve(output, 'profile.json'),
      JSON.stringify(results, null, 2),
    );
    await page.close();
  }
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  await page.goto(
    `${origin}/iframe.html?id=new-year-scenes--reindeer-takeoff-draft&viewMode=story`,
  );
  await page.locator(`${scene} svg`).waitFor();
  await page.waitForTimeout(10000);
  const draft = page.getByRole('textbox', { name: 'Message' });
  await draft.fill('A preserved draft');
  assert.equal(await page.locator(scene).count(), 0);
  assert.equal(
    await page
      .locator('[data-reindeer-word], [data-reindeer-word-mask]')
      .count(),
    0,
  );
  assert.equal(await draft.inputValue(), 'A preserved draft');
  const cdp = await page.context().newCDPSession(page);
  const replayAndCancel = async () => {
    await page.getByRole('button', { name: 'Replay' }).click();
    await page.locator(`${scene} svg`).waitFor();
    await page.waitForTimeout(100);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeinput')));
    await page.waitForFunction(
      (selector) => !document.querySelector(selector),
      scene,
    );
    assert.equal(
      await page
        .locator('[data-reindeer-word], [data-reindeer-word-mask]')
        .count(),
      0,
    );
    await page.waitForTimeout(100);
  };
  /* Warm the same replay/focus path before comparing browser-owned listeners. */
  await replayAndCancel();
  await cdp.send('HeapProfiler.collectGarbage');
  const before = await cdp.send('Memory.getDOMCounters');
  for (let i = 0; i < 20; i++) await replayAndCancel();
  await cdp.send('HeapProfiler.collectGarbage');
  const after = await cdp.send('Memory.getDOMCounters');
  assert(
    after.jsEventListeners <= before.jsEventListeners + 10,
    JSON.stringify({ before, after }),
  );
  assert(after.nodes <= before.nodes + 30, JSON.stringify({ before, after }));
  results.push({ cancellationCycles: 20, before, after });
  console.log(JSON.stringify(results.at(-1)));
  await page.goto(
    `${origin}/iframe.html?id=new-year-scenes--reindeer-takeoff-reduced-motion&viewMode=story`,
  );
  await page.locator('[data-reindeer-static]').waitFor();
  assert.equal(await page.locator(`${scene} svg`).count(), 0);
  await page.screenshot({
    path: resolve(output, 'reduced-motion.png'),
    caret: 'initial',
  });
  await page.goto(
    `${origin}/iframe.html?id=new-year-scenes--reindeer-takeoff-bottom-composer&viewMode=story`,
  );
  await page.locator(`${scene} svg`).waitFor();
  await page.screenshot({
    path: resolve(output, 'bottom-composer.png'),
    caret: 'initial',
  });
  await page.close();
  await writeFile(
    resolve(output, 'profile.json'),
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser.close();
}
