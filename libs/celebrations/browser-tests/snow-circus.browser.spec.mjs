import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';
import {
  captureFrame,
  percentile,
  startServer,
  workspace,
} from './storybook-harness.mjs';

const output = resolve(workspace, 'tmp/snow-circus/browser');
let browser;
let server;
let base;

before(async () => {
  await mkdir(output, { recursive: true });
  const hosted = await startServer();
  server = hosted.server;
  base = hosted.base;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  await new Promise((done) => server?.close(done) ?? done());
});

const open = async (
  width,
  story = 'desktop',
  reducedMotion = 'no-preference',
) => {
  const page = await browser.newPage({
    viewport: { width, height: 800 },
    reducedMotion,
  });
  await page.goto(
    `${base}/iframe.html?id=new-year-snow-circus--${story}&viewMode=story`,
  );
  await page.getByRole('button', { name: 'Replay Snow Circus' }).waitFor();
  await page.waitForTimeout(600);
  return page;
};
const countCopies = (page) =>
  page.locator('[data-celebration-snapshot]').count();

test('mobile, RTL, missing targets and reduced motion preserve the draft and clean up', async () => {
  const results = [];
  for (const [width, story, motion, expected] of [
    [360, 'mobile', 'no-preference', 1],
    [900, 'mobile', 'no-preference', 1],
    [1280, 'rtl', 'no-preference', 2],
    [1920, 'desktop', 'no-preference', 2],
    [360, 'missing-targets', 'no-preference', 0],
    [360, 'mobile', 'reduce', 0],
  ]) {
    const page = await open(width, story, motion);
    assert.equal(await countCopies(page), expected);
    if (motion === 'reduce') {
      assert.equal(
        await page.locator('[data-story-scene-layer] svg').count(),
        0,
      );
      assert.equal(
        await page.locator('[data-story-scene-layer] img').count(),
        1,
      );
    } else
      assert.equal(
        await page.locator('[data-story-scene-layer] svg').count(),
        1,
      );
    const cdp = await page.context().newCDPSession(page);
    await captureFrame(cdp, resolve(output, `${width}-${story}-${motion}.png`));
    await page.getByRole('textbox', { name: 'Message' }).fill('draft survives');
    await page.waitForTimeout(100);
    assert.equal(await countCopies(page), 0);
    assert.equal(await page.locator('[data-story-scene-layer] svg').count(), 0);
    assert.equal(
      await page.getByRole('textbox', { name: 'Message' }).inputValue(),
      'draft survives',
    );
    results.push({
      width,
      story,
      motion,
      copies: expected,
      cancellation: 'passed',
    });
    await page.close();
  }
  await writeFile(
    resolve(output, 'matrix.json'),
    JSON.stringify(results, null, 2),
  );
});

test('full mobile playback stays bounded and restores originals', async () => {
  const page = await open(360, 'mobile');
  await page.getByRole('button', { name: 'Replay Snow Circus' }).click();
  await page.waitForSelector('[data-button-props-copies]');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const before = await cdp.send('Performance.getMetrics');
  await page.evaluate(() => {
    window.snowCircusMetrics = { frames: [], longTasks: [] };
    let last = performance.now();
    const tick = (now) => {
      window.snowCircusMetrics.frames.push(now - last);
      last = now;
      window.snowCircusMetrics.raf = requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.snowCircusObserver = new PerformanceObserver((list) =>
      window.snowCircusMetrics.longTasks.push(
        ...list.getEntries().map((e) => e.duration),
      ),
    );
    window.snowCircusObserver.observe({ type: 'longtask' });
  });
  const start = await page.evaluate(() => performance.now());
  for (const second of [2.5, 6, 10.8, 14, 19.9, 20.8, 24.6, 26.5]) {
    const now = await page.evaluate(() => performance.now());
    await page.waitForTimeout(Math.max(0, start + second * 1000 - now));
    await captureFrame(cdp, resolve(output, `mobile-${second}.png`));
    const nodes = await page.locator('[data-story-scene-layer] svg *').count();
    assert(nodes <= 500, `${nodes} SVG nodes`);
  }
  const metrics = await page.evaluate(() => {
    cancelAnimationFrame(window.snowCircusMetrics.raf);
    window.snowCircusObserver.disconnect();
    return window.snowCircusMetrics;
  });
  const afterMetrics = await cdp.send('Performance.getMetrics');
  const timings = Object.fromEntries(
    afterMetrics.metrics
      .filter(({ name }) =>
        [
          'LayoutDuration',
          'RecalcStyleDuration',
          'ScriptDuration',
          'TaskDuration',
        ].includes(name),
      )
      .map(({ name, value }) => [
        name,
        value - (before.metrics.find((m) => m.name === name)?.value ?? 0),
      ]),
  );
  await writeFile(
    resolve(output, 'mobile-profile.json'),
    JSON.stringify(
      {
        p50: percentile(metrics.frames, 0.5),
        p95: percentile(metrics.frames, 0.95),
        p99: percentile(metrics.frames, 0.99),
        longTasks: metrics.longTasks,
        timings,
        note: 'Headless Chromium with screenshot capture; not a physical phone benchmark.',
      },
      null,
      2,
    ),
  );
  assert.equal(await countCopies(page), 0);
  assert.equal(await page.locator('[data-story-scene-layer] svg').count(), 0);
  assert.equal(
    await page.getByRole('textbox', { name: 'Message' }).inputValue(),
    'My draft stays here',
  );
  const opacities = await page
    .locator('.story-composer button')
    .evaluateAll((buttons) =>
      buttons.map((button) => getComputedStyle(button).opacity),
    );
  assert(opacities.every((opacity) => opacity === '1'));
  await page.close();
});

test('repeated pickup cancellation leaves no copies or running animations', async () => {
  const page = await open(1280);
  for (let i = 0; i < 5; i++) {
    await page.getByRole('button', { name: 'Replay Snow Circus' }).click();
    await page.waitForSelector('[data-button-props-copies]');
    await page.waitForTimeout(1850);
    if (i % 2)
      await page
        .getByRole('button', { name: 'Model', exact: true })
        .evaluate((button) => {
          button.textContent = 'Model';
        });
    else
      await page.getByRole('textbox', { name: 'Message' }).fill(`draft ${i}`);
    await page.waitForTimeout(100);
    assert.equal(await countCopies(page), 0);
    assert.equal(await page.locator('[data-story-scene-layer] svg').count(), 0);
    assert.equal(await page.evaluate(() => document.getAnimations().length), 0);
  }
  await page.close();
});

test('a right-edge mobile button uses drawn snow and keeps the returning cast visible', async () => {
  const page = await open(360, 'mobile');
  await page.getByRole('textbox', { name: 'Message' }).fill('edge draft');
  await page.locator('.story-composer').evaluate((composer) => {
    composer.style.cssText =
      'position:fixed;left:12px;top:400px;width:336px;height:100px;padding:0;border:0';
    composer.querySelectorAll('button').forEach((button) => {
      button.hidden = true;
    });
    const button = document.createElement('button');
    button.textContent = 'Edge';
    button.style.cssText =
      'position:absolute;right:8px;top:20px;width:40px;height:40px';
    composer.append(button);
  });
  await page.getByRole('button', { name: 'Replay Snow Circus' }).click();
  await page.waitForSelector('[data-button-props-copies]');
  assert.equal(await countCopies(page), 0);
  await page.waitForTimeout(23000);
  const visible = await page
    .locator('[data-story-scene-layer] svg path')
    .evaluateAll((paths) =>
      paths
        .filter((path) => !path.closest('defs'))
        .flatMap((path) => {
          for (
            let ancestor = path;
            ancestor instanceof Element;
            ancestor = ancestor.parentElement
          ) {
            const style = getComputedStyle(ancestor);
            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              style.opacity === '0'
            )
              return [];
          }
          const rect = path.getBoundingClientRect();
          return rect.width && rect.height
            ? [
                {
                  left: rect.left,
                  right: rect.right,
                  top: rect.top,
                  bottom: rect.bottom,
                },
              ]
            : [];
        }),
    );
  assert(visible.length > 10, 'the scene must still be visible during return');
  assert(
    visible.every(
      (rect) =>
        rect.left >= 0 &&
        rect.right <= 360 &&
        rect.top >= 0 &&
        rect.bottom <= 800,
    ),
    JSON.stringify(visible),
  );
  const cdp = await page.context().newCDPSession(page);
  await captureFrame(cdp, resolve(output, 'mobile-edge-return.png'));
  assert.equal(
    await page
      .getByRole('button', { name: 'Edge', exact: true })
      .evaluate((button) => getComputedStyle(button).opacity),
    '1',
  );
  await page
    .getByRole('textbox', { name: 'Message' })
    .fill('edge draft survives');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('[data-story-scene-layer] svg').count(), 0);
  assert.equal(await countCopies(page), 0);
  await page.close();
});
