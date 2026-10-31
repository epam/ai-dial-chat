/* Run with the local celebrations Storybook on port 6010. Profile in isolation
   from builds/tests; recordings show normal playback, probes run separately. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const origin = process.env.STORYBOOK_URL ?? 'http://localhost:6010';
const output = resolve('tmp/new-year-audit/after');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const scenes = [
  {
    id: 'penguin-star',
    duration: 20,
    bytes: 120000,
    nodes: 140,
    times: [3.5, 5.1, 6.7, 8.5, 10.9, 13, 15.1, 18],
  },
  {
    id: 'gift-wrapping',
    duration: 16,
    bytes: 240000,
    nodes: 500,
    times: [1.8, 4.5, 6.35, 7.05, 8.7, 10.65, 13.3, 15.4],
  },
];
const widths = (process.env.NEW_YEAR_WIDTHS ?? '360,900,1280,1920')
  .split(',')
  .map(Number);
const selector = (scene) => `[data-new-year-scene="${scene.id}"]`;
const open = async (scene, width, record = false, reduced = false) => {
  const page = await browser.newPage({
    viewport: { width, height: 900 },
    ...(record
      ? {
          recordVideo: {
            dir: resolve(output, 'videos'),
            size: { width, height: 900 },
          },
        }
      : {}),
  });
  const cdp = await page.context().newCDPSession(page);
  if (record)
    await cdp.send('Emulation.setCPUThrottlingRate', {
      rate: width < 1280 ? 4 : 1,
    });
  await page.addInitScript((dark) => {
    window.motionProfile = { frames: [], longTasks: [], reads: 0 };
    new PerformanceObserver((list) => {
      if (window.measureMotion)
        window.motionProfile.longTasks.push(
          ...list.getEntries().map(({ duration }) => duration),
        );
    }).observe({ type: 'longtask', buffered: true });
    const frame = (time) => {
      if (window.measureMotion) window.motionProfile.frames.push(time);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    const bounds = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if (
        window.measureMotion &&
        this.matches('.story-composer, .story-model, .story-starters, h1')
      )
        window.motionProfile.reads++;
      return bounds.call(this);
    };
    if (dark)
      document.addEventListener('DOMContentLoaded', () => {
        const style = document.createElement('style');
        style.textContent =
          '.bg-layer-1 { background: #181b25 !important; color: #edf0f7 !important; }';
        document.head.append(style);
      });
  }, width === 1920);
  const suffix = reduced
    ? '-reduced-motion'
    : width === 900
      ? '-rtl'
      : width === 360
        ? '-mobile'
        : '';
  await page.goto(
    `${origin}/iframe.html?id=new-year-scenes--${scene.id}${suffix}&viewMode=story&args=isMobile:${width < 1280}`,
  );
  return { page, cdp };
};
const register = async (page, scene, width) => {
  await page.locator(`${selector(scene)} svg`).waitFor();
  return page.evaluate(
    async ({ id, mobile }) => {
      const { loadLottiePlayer } = await import('/src/utils/lottie-player.ts');
      window.motionPlayer = (
        await loadLottiePlayer()
      ).getRegisteredAnimations()[0];
      const anchors = {
        composer: 'story-composer',
        composerModelSelector: 'story-model',
        starterList: 'story-starters',
        welcomeRegion: '[role="region"]',
      };
      if (id === 'penguin-star') {
        const { getPenguinStarTargets } =
          await import('/src/new-year/utils/penguin-star-targets.ts');
        const { buildPenguinStarComposition } =
          await import('/src/new-year/utils/penguin-star-composition.ts');
        window.motionPlan = buildPenguinStarComposition(
          getPenguinStarTargets(anchors, mobile),
          mobile,
        );
      } else {
        const { getGiftWrappingTarget } =
          await import('/src/new-year/utils/gift-wrapping-targets.ts');
        const { buildGiftWrappingComposition } =
          await import('/src/new-year/utils/gift-wrapping-composition.ts');
        window.motionPlan = buildGiftWrappingComposition(
          getGiftWrappingTarget(anchors, mobile),
          mobile,
        );
      }
      const controls = [
        ...document.querySelectorAll('.story-starters button, .story-model'),
      ];
      window.motionOriginals = controls.map((element) => ({
        element,
        transform: getComputedStyle(element).transform,
        opacity: getComputedStyle(element).opacity,
      }));
      const host = document.querySelector(`[data-new-year-scene="${id}"]`);
      return {
        bytes: new TextEncoder().encode(
          JSON.stringify(window.motionPlan.animationData),
        ).length,
        nodes: host.querySelectorAll('svg *').length,
        paths: host.querySelectorAll('svg path').length,
      };
    },
    { id: scene.id, mobile: width < 1280 },
  );
};
try {
  for (const width of widths)
    for (const scene of scenes) {
      const { page } = await open(scene, width, true);
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const counts = await register(page, scene, width);
      assert(counts.bytes <= scene.bytes, `${scene.id}/${width}: data budget`);
      assert(counts.nodes <= scene.nodes, `${scene.id}/${width}: SVG budget`);
      if (scene.id === 'gift-wrapping') assert(counts.paths <= 180);
      await page.evaluate(() => {
        window.measureMotion = true;
      });
      for (const seconds of scene.times) {
        const now = await page.evaluate(
          () =>
            window.motionPlayer.currentFrame / window.motionPlayer.frameRate,
        );
        await page.waitForTimeout(Math.max(0, (seconds - now) * 1000));
        await page.screenshot({
          path: resolve(output, `${scene.id}-${width}-${seconds}.png`),
          caret: 'initial',
        });
      }
      const now = await page.evaluate(
        () => window.motionPlayer.currentFrame / window.motionPlayer.frameRate,
      );
      await page.waitForTimeout(
        Math.max(0, (scene.duration - now) * 1000) + 300,
      );
      const metrics = await page.evaluate(() => {
        window.measureMotion = false;
        const { frames, ...counts } = window.motionProfile;
        const intervals = frames
          .slice(1)
          .map((time, i) => time - frames[i])
          .sort((a, b) => a - b);
        return {
          ...counts,
          p95: intervals[Math.floor(intervals.length * 0.95)],
          p99: intervals[Math.floor(intervals.length * 0.99)],
          overflow: document.documentElement.scrollWidth > innerWidth,
          restored: window.motionOriginals.every(
            ({ element, transform, opacity }) =>
              getComputedStyle(element).transform === transform &&
              getComputedStyle(element).opacity === opacity,
          ),
        };
      });
      assert.equal(metrics.overflow, false);
      assert.equal(metrics.restored, true);
      assert.equal(metrics.reads, 0);
      assert.deepEqual(errors, []);
      const video = page.video();
      await page.close();
      await video.saveAs(resolve(output, `${scene.id}-${width}.webm`));

      const probe = await open(scene, width);
      await register(probe.page, scene, width);
      const contacts = await probe.page.evaluate((id) => {
        const player = window.motionPlayer;
        player.pause();
        const layer = (name) =>
          player.renderer.elements.find(({ data }) => data.nm === name);
        const point = (element, x, y) =>
          new DOMPoint(x, y).matrixTransform(element.getScreenCTM());
        const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
        const seek = (t) => player.goToAndStop(t * player.frameRate, true);
        const group = (shapes, items, name) => {
          for (let i = 0; i < shapes.length; i++) {
            if (shapes[i].nm === name) return items[i].gr;
            if (shapes[i].it) {
              const found = group(shapes[i].it, items[i].it, name);
              if (found) return found;
            }
          }
        };
        if (id === 'penguin-star') {
          let shoulder = 0;
          for (let t = 0.1; t <= 19; t += 0.05) {
            seek(t);
            shoulder = Math.max(
              shoulder,
              gap(
                point(layer('penguin').layerElement, 20, -47),
                point(layer('penguin-flipper').layerElement, 0, 0),
              ),
            );
          }
          seek(6.7);
          const hand = point(layer('penguin-flipper').layerElement, 28, 0);
          const capture = gap(hand, {
            x: window.motionPlan.capturePoint[0],
            y: window.motionPlan.capturePoint[1],
          });
          seek(8.4999);
          const release = point(layer('penguin-flipper').layerElement, 28, 0);
          seek(8.5);
          const launch = gap(
            release,
            point(layer('thrown-star').layerElement, 0, 0),
          );
          return { shoulder, capture, launch };
        }
        const helper = layer('helper');
        const hand = group(helper.shapesData, helper.itemsData, 'forearm');
        const ribbon = layer('loose-ribbon').layerElement.querySelector('path');
        let grip = 0;
        for (let t = 2; t <= 8; t += 0.05) {
          seek(t);
          const values = ribbon
            .getAttribute('d')
            .match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)
            .map(Number);
          grip = Math.max(
            grip,
            gap(point(hand, 19, 0), point(ribbon, values[6], values[7])),
          );
        }
        return { grip };
      }, scene.id);
      for (const [name, error] of Object.entries(contacts))
        assert(error < 1.5, `${scene.id}/${width}: ${name} gap ${error}`);
      await probe.page
        .getByRole('textbox', { name: 'Message' })
        .fill('Draft survives the scene');
      assert.equal(await probe.page.locator(selector(scene)).count(), 0);
      assert.equal(
        await probe.page.getByRole('textbox', { name: 'Message' }).inputValue(),
        'Draft survives the scene',
      );
      if (width === 1280) {
        const cancel = async () => {
          await probe.page.getByRole('button', { name: 'Replay' }).click();
          await probe.page.locator(`${selector(scene)} svg`).waitFor();
          await probe.page.evaluate(() =>
            window.dispatchEvent(new Event('beforeinput')),
          );
          await probe.page.waitForFunction(
            (s) => !document.querySelector(s),
            selector(scene),
          );
          await probe.page.waitForTimeout(100);
        };
        await cancel();
        await probe.cdp.send('HeapProfiler.collectGarbage');
        const before = await probe.cdp.send('Memory.getDOMCounters');
        for (let i = 0; i < 20; i++) await cancel();
        await probe.cdp.send('HeapProfiler.collectGarbage');
        const after = await probe.cdp.send('Memory.getDOMCounters');
        assert(
          after.nodes <= before.nodes + 30 &&
            after.jsEventListeners <= before.jsEventListeners + 10,
          JSON.stringify({ before, after }),
        );
        results.push({
          scene: scene.id,
          cancellationCycles: 20,
          before,
          after,
        });
      }
      await probe.page.close();
      results.push({
        scene: scene.id,
        width,
        cpu: width < 1280 ? 4 : 1,
        ...counts,
        ...metrics,
        contacts,
      });
      console.log(JSON.stringify(results.at(-1)));
      await writeFile(
        resolve(output, 'profile.json'),
        JSON.stringify(results, null, 2),
      );
    }
  for (const scene of scenes) {
    const { page } = await open(scene, 1280, false, true);
    const still =
      scene.id === 'gift-wrapping'
        ? '[data-gift-static]'
        : 'svg[data-penguin-static]';
    await page.locator(still).waitFor();
    assert.equal(await page.locator(selector(scene)).count(), 0);
    await page.screenshot({
      path: resolve(output, `${scene.id}-reduced-motion.png`),
      caret: 'initial',
    });
    await page.close();
  }
} finally {
  await browser.close();
}
