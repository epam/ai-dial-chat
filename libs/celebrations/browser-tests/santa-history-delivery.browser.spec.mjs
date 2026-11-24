/* Current unpublished full story through production LottieScene. These checks
 * establish runtime behaviour and retention, never artistic motion acceptance.
 * Run against an existing build with CELEBRATIONS_STORYBOOK_URL, or let the
 * shared harness serve the local production Storybook on an isolated port. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  waitUntil,
} from './storybook-harness.mjs';

const STORY = 'packs-santahistorydelivery--full-story';
const LAYER = '[data-story-scene-layer]';
const RENDERER = `${LAYER} [data-celebration-anchor] > svg`;
const COPY = '[data-celebration-snapshot]';
const PLAYBACK_MS = 27000;
const shouldCaptureFrames = process.env.CELEBRATIONS_CAPTURE_FRAMES !== 'false';
const BORROWED_MS = 3800;
const directory = resolve(output, 'santa-history-delivery-full');
await mkdir(directory, { recursive: true });
const fixtureDirectory = resolve(
  import.meta.dirname,
  '../src/stories/fixtures/external',
);
const fullProvenance = await readFile(
  resolve(import.meta.dirname, '../src/test-utils/santa-history-full.ts'),
  'utf8',
);
const sharedProvenance = await readFile(
  resolve(import.meta.dirname, '../src/test-utils/santa-history-delivery.ts'),
  'utf8',
);
const files = [
  ...fullProvenance.matchAll(/file:\s*['"]([^'"]+)['"]/g),
  ...sharedProvenance.matchAll(/file:\s*['"]([^'"]+\.poster\.[^'"]+)['"]/g),
].map((match) => match[1]);
assert.equal(
  files.length,
  3,
  'Expected two pinned full variants and their shared poster',
);
const sourceBytes = new Map();
const assets = await Promise.all(
  files.map(async (file) => {
    const bytes = await readFile(resolve(fixtureDirectory, file));
    sourceBytes.set(file, bytes);
    return {
      file,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }),
);
const source = {
  repository: 'epam/ai-dial-chat-themes',
  path: 'authoring/santa-history-delivery',
  status: 'unpublished full story',
  assets,
};
const native = JSON.parse(
  sourceBytes
    .get(files.find((name) => name.includes('.full.desktop.')))
    .toString(),
);
const restoreMarker = native.markers.find(({ cm }) => cm === 'hl:restore');
assert.ok(restoreMarker, 'Pinned source must declare restoration');
assert.equal((native.op / native.fr) * 1000, PLAYBACK_MS);
const RESTORED_MS =
  (restoreMarker.tm / native.fr) * 1000 + PLAYBACK_MS * 0.04 + 150;
const save = (name, value) =>
  writeFile(
    resolve(directory, name),
    JSON.stringify({ captureId, revision, source, ...value }, null, 2),
  );

/* A provided server can point at an older build. Match the actually loaded
   loader bundle against the pinned asset identities before claiming evidence
   for local source hashes; no application instrumentation is required. */
const verifyServedSource = async (page) => {
  const bundleUrl = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map(({ name }) => name)
      .find((name) => /\/pack-story-loaders-[^/]+\.js(?:\?|$)/.test(name)),
  );
  assert.ok(
    bundleUrl,
    'The served production loader bundle must be identifiable',
  );
  const response = await page.request.get(bundleUrl);
  assert.equal(
    response.ok(),
    true,
    'The served loader bundle must be readable',
  );
  const bytes = await response.body();
  const text = bytes.toString();
  for (const asset of assets)
    assert.ok(
      text.includes(asset.sha256),
      `Served bundle does not contain pinned ${asset.file}`,
    );
  const served = {
    url: bundleUrl,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    pinnedAssetHashes: assets.map(({ sha256 }) => sha256),
    verification:
      'The actually loaded production loader bundle contains the pinned full variants/poster SHA metadata; playback separately asserts full duration and source cache integrity.',
  };
  await save('served-source.json', served);
  return served;
};

/* Test-only counters, without application hooks. Resource counts include
 * connected observers and scheduled JS callbacks, not browser internals.
 * Real native/WAAPI time runs unchanged. */
const instrument = () => {
  const timeouts = new Set();
  const intervals = new Set();
  const rafs = new Set();
  const observers = { MutationObserver: new Set(), ResizeObserver: new Set() };
  const native = {
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame,
    cancelAnimationFrame,
  };
  window.setTimeout = function (handler, delay, ...args) {
    if (typeof handler !== 'function')
      return native.setTimeout.call(window, handler, delay, ...args);
    const id = native.setTimeout.call(
      window,
      (...values) => {
        timeouts.delete(id);
        handler(...values);
      },
      delay,
      ...args,
    );
    timeouts.add(id);
    return id;
  };
  window.setInterval = (handler, delay, ...args) => {
    const id = native.setInterval.call(window, handler, delay, ...args);
    intervals.add(id);
    return id;
  };
  for (const name of ['clearTimeout', 'clearInterval'])
    window[name] = (id) => {
      timeouts.delete(id);
      intervals.delete(id);
      return native[name].call(window, id);
    };
  window.requestAnimationFrame = (callback) => {
    const id = native.requestAnimationFrame.call(window, (time) => {
      rafs.delete(id);
      callback(time);
    });
    rafs.add(id);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    rafs.delete(id);
    return native.cancelAnimationFrame.call(window, id);
  };
  for (const name of Object.keys(observers)) {
    const Original = window[name];
    window[name] = class extends Original {
      observe(...args) {
        super.observe(...args);
        observers[name].add(this);
      }
      disconnect() {
        super.disconnect();
        observers[name].delete(this);
      }
    };
  }
  const state = (window.historyEvidence = {
    created: 0,
    destroyed: 0,
    hostReads: 0,
  });
  const getRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    if (
      this.matches?.(
        '.santa-history-fixture,.santa-history-fixture li,.santa-history-composer,.santa-history-add,.santa-history-model,.santa-history-starters,.santa-history-welcome h1',
      )
    )
      state.hostReads++;
    return getRect.apply(this, args);
  };
  window.historyResources = () => ({
    timeouts: timeouts.size,
    intervals: intervals.size,
    animationFrames: rafs.size,
    mutationObservers: observers.MutationObserver.size,
    resizeObservers: observers.ResizeObserver.size,
    players: window.historyPlayer?.getRegisteredAnimations().length ?? 0,
    snapshots: document.querySelectorAll('[data-celebration-snapshot]').length,
    sceneNodes:
      document.querySelector('[data-story-scene-layer]')?.querySelectorAll('*')
        .length ?? 0,
    liveDocumentNodes: document.querySelectorAll('*').length,
    webAnimations: document.getAnimations().length,
  });
};

const withBrowser = async (run) => {
  const provided = process.env.CELEBRATIONS_STORYBOOK_URL;
  const served = provided ? { base: provided } : await startServer();
  let browser;
  try {
    browser = await chromium.launch();
    return await run(browser, served.base);
  } finally {
    await browser?.close();
    if (served.server) await new Promise((done) => served.server.close(done));
  }
};

const connectPlayer = async (page) =>
  page.evaluate(async () => {
    if (window.historyPlayer) return;
    const url = performance
      .getEntriesByType('resource')
      .map(({ name }) => name)
      .find((name) => /\/lottie_light[^/]*\.js(?:\?|$)/.test(name));
    if (!url) throw new Error('Pinned player chunk did not load');
    const module = await import(url);
    const player = Object.values(module).find(
      (value) => typeof value?.getRegisteredAnimations === 'function',
    );
    if (!player) throw new Error('Pinned player export missing');
    window.historyPlayer = player;
    const observe = (item) => {
      window.historyEvidence.created++;
      const destroy = item.destroy;
      let isDestroyed = false;
      item.destroy = function (...args) {
        if (!isDestroyed) {
          isDestroyed = true;
          window.historyEvidence.destroyed++;
        }
        return destroy.apply(this, args);
      };
      return item;
    };
    player.getRegisteredAnimations().forEach(observe);
    const load = player.loadAnimation;
    player.loadAnimation = function (...args) {
      return observe(load.apply(this, args));
    };
  });

const open = async (browser, base, width, args = {}, options = {}) => {
  const context = await browser.newContext({
    viewport: { width, height: width < 1280 ? 900 : 1000 },
    deviceScaleFactor: 1,
    isMobile: width < 1280,
    hasTouch: width < 1280,
    ...options,
  });
  await context.addInitScript(instrument);
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  const query = Object.entries({
    isMobile: width < 1280,
    hasHistory: width >= 1280,
    ...args,
  })
    .map(
      ([key, value]) =>
        `${key}:${typeof value === 'boolean' ? `!${value}` : value}`,
    )
    .join(';');
  await page.goto(
    `${base}/iframe.html?id=${STORY}&viewMode=story&args=${query}`,
    { waitUntil: 'domcontentloaded' },
  );
  await page
    .getByRole('textbox', { name: 'Message' })
    .waitFor({ timeout: 15000 });
  const served = await verifyServedSource(page);
  const cdp = await context.newCDPSession(page);
  return { context, page, cdp, errors, requests, served };
};
const start = async (page) => {
  await page.locator(RENDERER).waitFor({ timeout: 8000 });
  await connectPlayer(page);
  await page.waitForFunction(
    () => window.historyPlayer.getRegisteredAnimations()[0]?.currentFrame > 0,
  );
  return page.evaluate(() => {
    const item = window.historyPlayer.getRegisteredAnimations()[0];
    if (Math.abs((item.totalFrames / item.frameRate) * 1000 - 27000) > 1)
      throw new Error('Expected the pinned full27-second asset');
    return performance.now() - (item.currentFrame / item.frameRate) * 1000;
  });
};
const empty = (page, timeout = 4000) =>
  page.waitForFunction(
    () => !document.querySelector('[data-story-scene-layer]')?.children.length,
    null,
    { timeout },
  );
const cancel = async (page) => {
  await page.evaluate(() => window.dispatchEvent(new Event('input')));
  await empty(page);
};
const replay = async (page) => {
  await page
    .getByRole('button', { name: 'Replay Santa', exact: true })
    .evaluate((button) => button.click());
  return start(page);
};

const rememberHost = (page) =>
  page.evaluate(() => {
    const input = document.querySelector('textarea[aria-label="Message"]');
    const rows = [...document.querySelectorAll('.santa-history-fixture li')];
    window.historyHostBefore = {
      input,
      rows,
      html: rows.map((row) => row.outerHTML),
      rowStyles: rows.map((row) => row.getAttribute('style')),
      linkText: rows.map((row) => row.firstElementChild.textContent),
      inputValue: input.value,
      start: input.selectionStart,
      end: input.selectionEnd,
      active: document.activeElement,
      inputStyle: input.getAttribute('style'),
      inputClass: input.className,
    };
  });
const hostState = (page) =>
  page.evaluate(() => {
    const before = window.historyHostBefore;
    const rows = [...document.querySelectorAll('.santa-history-fixture li')];
    const input = document.querySelector('textarea[aria-label="Message"]');
    return {
      inputIdentity: input === before.input,
      rowIdentityAndOrder:
        rows.length === before.rows.length &&
        rows.every((row, index) => row === before.rows[index]),
      rowsUnchanged: rows.every(
        (row, index) => row.outerHTML === before.html[index],
      ),
      draftUnchanged: input.value === before.inputValue,
      selectionUnchanged:
        input.selectionStart === before.start &&
        input.selectionEnd === before.end,
      focusUnchanged: document.activeElement === before.active,
      inputPresentationUnchanged:
        input.getAttribute('style') === before.inputStyle &&
        input.className === before.inputClass,
      opacity: rows.map((row) => Number(getComputedStyle(row).opacity)),
      snapshots: document.querySelectorAll('[data-celebration-snapshot]')
        .length,
      copiesInert: [
        ...document.querySelectorAll('[data-celebration-snapshot]'),
      ].every(
        (copy) =>
          copy.inert &&
          copy.getAttribute('aria-hidden') === 'true' &&
          !copy.querySelector('a[href]'),
      ),
    };
  });
const assertHost = (state, { restored = true, unchangedFocus = true } = {}) => {
  for (const key of [
    'inputIdentity',
    'rowIdentityAndOrder',
    'rowsUnchanged',
    'draftUnchanged',
    'selectionUnchanged',
    'inputPresentationUnchanged',
    'copiesInert',
  ])
    assert.equal(state[key], true, key);
  if (unchangedFocus) assert.equal(state.focusUnchanged, true);
  if (restored)
    assert.ok(
      state.opacity.every((value) => value === 1),
      'Every live row must regain opacity1',
    );
};
const checkCache = async (page) => {
  await page
    .getByRole('button', { name: 'Check cache', exact: true })
    .evaluate((button) => button.click());
  assert.match(await page.locator('body').innerText(), /Cache pristine: yes/);
  assert.match(await page.locator('body').innerText(), /Data requests: 1/);
};
const borrowed = async (page, zero) => {
  await waitUntil(page, zero + BORROWED_MS);
  const state = await hostState(page);
  assert.equal(state.snapshots, 1);
  assert.equal(state.opacity.filter((value) => value < 0.01).length, 1);
  assertHost(state, { restored: false });
  return state;
};
const nativeInfo = (page) =>
  page.evaluate(() => {
    const item = window.historyPlayer.getRegisteredAnimations()[0];
    return {
      durationMs: (item.totalFrames / item.frameRate) * 1000,
      frame: item.currentFrame,
      players: window.historyPlayer.getRegisteredAnimations().length,
      nativeElements: item.renderer.svgElement.querySelectorAll('*').length + 1,
      snapshots: document.querySelectorAll('[data-celebration-snapshot]')
        .length,
      mirrored:
        item.animationData.layers.find(({ nm }) => nm === 'hl-track:actor').ks.s
          .k[0] < 0,
    };
  });

const collectFrameIntervals = (page) =>
  page.evaluate(() => {
    const item = window.historyPlayer.getRegisteredAnimations()[0];
    const evidence = (window.historyFrameIntervals = {
      startNativeFrame: item.currentFrame,
      startedAt: performance.now(),
      endedAt: null,
      intervals: [],
    });
    let previous;
    const sample = (time) => {
      const active = window.historyPlayer.getRegisteredAnimations()[0];
      if (!active) {
        evidence.endedAt = performance.now();
        return;
      }
      if (!active.isPaused && active.currentFrame > 0) {
        if (previous !== undefined) evidence.intervals.push(time - previous);
        previous = time;
      } else previous = undefined;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

for (const [width, direction, theme, isDocked] of [
  [360, 'ltr', 'light', false],
  [390, 'rtl', 'dark', true],
  [1280, 'ltr', 'light', false],
  [1920, 'rtl', 'dark', true],
]) {
  test(
    `full clock preserves host at ${width}px ${direction} ${theme}`,
    { timeout: 60000 },
    () =>
      withBrowser(async (browser, base) => {
        const { context, page, cdp, errors } = await open(
          browser,
          base,
          width,
          { dir: direction, colorScheme: theme, isDocked },
        );
        try {
          const zero = await start(page);
          await collectFrameIntervals(page);
          await rememberHost(page);
          const initial = await nativeInfo(page);
          assert.equal(initial.players, 1);
          assert.equal(initial.mirrored, direction === 'rtl');
          assert.ok(initial.nativeElements <= 800);
          if (width >= 1280) await borrowed(page, zero);
          else {
            await waitUntil(page, zero + BORROWED_MS);
            assert.equal((await hostState(page)).snapshots, 0);
          }
          const hostReads = await page.evaluate(
            () => window.historyEvidence.hostReads,
          );
          await page.waitForTimeout(180);
          assert.equal(
            await page.evaluate(() => window.historyEvidence.hostReads),
            hostReads,
            'No per-frame host layout reads',
          );
          if (shouldCaptureFrames)
            await captureFrame(
              cdp,
              resolve(directory, `${width}-${direction}-${theme}-borrow.png`),
            );
          await waitUntil(page, zero + RESTORED_MS);
          const restored = await hostState(page);
          assertHost(restored);
          await waitUntil(page, zero + 22000);
          const rescue = await nativeInfo(page);
          if (shouldCaptureFrames)
            await captureFrame(
              cdp,
              resolve(directory, `${width}-${direction}-${theme}-rescue.png`),
            );
          await waitUntil(page, zero + PLAYBACK_MS + 250);
          await empty(page);
          const after = await hostState(page);
          assertHost(after);
          assert.equal(after.snapshots, 0);
          assert.equal(
            await page.evaluate(() => window.historyResources().players),
            0,
          );
          const frameWindow = await page.evaluate(
            () => window.historyFrameIntervals,
          );
          assert.ok(
            frameWindow.endedAt !== null && frameWindow.intervals.length > 100,
            'Expected a real native-playback frame sample',
          );
          const frameIntervals = {
            ...frameWindow,
            count: frameWindow.intervals.length,
            p50Ms: percentile(frameWindow.intervals, 0.5),
            p95Ms: percentile(frameWindow.intervals, 0.95),
            over50Ms: frameWindow.intervals.filter((interval) => interval > 50)
              .length,
            maxMs: Math.max(...frameWindow.intervals),
            screenshotsIncluded: shouldCaptureFrames,
            limitation:
              'Browser rAF intervals from the first observed active native frame through completion, with test instrumentation. These are diagnostic observations, not a guaranteed FPS claim.',
          };
          await checkCache(page);
          assert.deepEqual(errors, []);
          await save(`${width}-${direction}-${theme}-full-clock.json`, {
            width,
            direction,
            theme,
            isDocked,
            initial,
            restored,
            rescue,
            after,
            errors,
            frameIntervals,
            preparationDuration: {
              measured: false,
              reason:
                'No dedicated production preparation timing mark is exposed; no benchmark hook was added.',
            },
            limitation:
              'Runtime playback followed the real27-second clock. Still captures and lifecycle assertions do not establish artistic readability.',
          });
        } finally {
          await context.close();
        }
      }),
  );
}

const interrupt = async (page, name) => {
  if (name === 'row content')
    return page
      .locator('.santa-history-fixture li')
      .nth(2)
      .evaluate((row) => {
        row.firstElementChild.textContent = 'Changed while borrowed';
      });
  if (name === 'row geometry')
    return page
      .locator('.santa-history-fixture li')
      .nth(3)
      .evaluate((row) => {
        row.style.marginTop = '1px';
      });
  if (name === 'hidden tab')
    return page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
  if (name.startsWith('visual '))
    return page.evaluate(
      (event) => visualViewport.dispatchEvent(new Event(event)),
      name.slice(7),
    );
  if (name === 'focus')
    return page.getByRole('textbox', { name: 'Message' }).focus();
  return page.evaluate((event) => {
    const target = ['scroll', 'resize'].includes(event)
      ? window
      : document.querySelector('textarea[aria-label="Message"]');
    target.dispatchEvent(new Event(event, { bubbles: true }));
  }, name);
};
const restoreMutation = async (page, name) =>
  page.evaluate((event) => {
    const before = window.historyHostBefore;
    if (event === 'row content')
      before.rows[2].firstElementChild.textContent = before.linkText[2];
    if (event === 'row geometry') {
      if (before.rowStyles[3] === null) before.rows[3].removeAttribute('style');
      else before.rows[3].setAttribute('style', before.rowStyles[3]);
    }
    if (event === 'hidden tab') delete document.hidden;
  }, name);

test(
  'borrowed row restores immediately for each live interruption',
  { timeout: 90000 },
  () =>
    withBrowser(async (browser, base) => {
      const { context, page, errors } = await open(browser, base, 1280);
      try {
        await start(page);
        await cancel(page);
        const results = [];
        for (const event of [
          'input',
          'focus',
          'scroll',
          'resize',
          'row content',
          'row geometry',
          'hidden tab',
          'visual resize',
        ]) {
          await page
            .getByRole('textbox', { name: 'Message' })
            .evaluate((node) => node.blur());
          await rememberHost(page);
          const zero = await replay(page);
          await borrowed(page, zero);
          const beforeInterrupt = await page.evaluate(() => performance.now());
          await interrupt(page, event);
          /* Snapshot/WAAPI cleanup is synchronous or runs at the mutation
             microtask; do not let a multi-second React wait hide a delay. */
          const immediate = await hostState(page);
          assert.equal(
            immediate.snapshots,
            0,
            `${event}: copy remained after interruption`,
          );
          assert.ok(
            immediate.opacity.every((value) => value === 1),
            `${event}: live row was not restored immediately`,
          );
          await empty(page);
          const restoreMs = await page.evaluate(
            (before) => performance.now() - before,
            beforeInterrupt,
          );
          const terminal = await hostState(page);
          assert.equal(terminal.snapshots, 0);
          assert.ok(terminal.opacity.every((value) => value === 1));
          assert.equal(terminal.draftUnchanged, true);
          assert.equal(terminal.rowIdentityAndOrder, true);
          await restoreMutation(page, event);
          const restored = await hostState(page);
          assertHost(restored, { unchangedFocus: event !== 'focus' });
          results.push({ event, restoreMs, immediate, terminal, restored });
        }
        await checkCache(page);
        assert.deepEqual(errors, []);
        await save('interruptions.json', {
          results,
          errors,
          limitation:
            'DOM events exercise the real cancellation path. Hidden-tab state is injected, not an OS tab switch; focus uses a real browser focus change. The explicit test mutation is restored after proving scene cleanup.',
        });
      } finally {
        await context.close();
      }
    }),
);

for (const [name, args, width] of [
  ['closed', { hasHistory: false }, 1280],
  ['empty', { isEmptyHistory: true }, 1280],
  ['irregular', { isIrregularHistory: true }, 1280],
  ['mobile', { hasHistory: false }, 360],
]) {
  test(
    `${name} history chooses complete native alternative without copies`,
    { timeout: 20000 },
    () =>
      withBrowser(async (browser, base) => {
        const { context, page, errors } = await open(
          browser,
          base,
          width,
          args,
        );
        try {
          const zero = await start(page);
          await rememberHost(page);
          await waitUntil(page, zero + BORROWED_MS);
          assert.equal(await page.locator(COPY).count(), 0);
          const info = await nativeInfo(page);
          assert.equal(info.durationMs, PLAYBACK_MS);
          assert.equal(
            await page.evaluate(
              () =>
                window.historyPlayer
                  .getRegisteredAnimations()[0]
                  .animationData.layers.filter(
                    ({ nm, hd }) => nm?.startsWith('hl-if:drawn') && !hd,
                  ).length > 0,
            ),
            true,
          );
          await cancel(page);
          assertHost(await hostState(page));
          assert.deepEqual(errors, []);
          await save(`fallback-${name}.json`, { name, width, info, errors });
        } finally {
          await context.close();
        }
      }),
  );
}

for (const width of [360, 1280]) {
  test(
    `reduced motion ${width}px protects controls without loading a player`,
    { timeout: 15000 },
    () =>
      withBrowser(async (browser, base) => {
        const { context, page, errors, requests } = await open(
          browser,
          base,
          width,
          { hasHistory: true },
          { reducedMotion: 'reduce' },
        );
        try {
          await rememberHost(page);
          await page
            .locator(`${LAYER} img`)
            .waitFor({ state: 'visible', timeout: 2500 });
          const boxes = await page.evaluate(() => {
            const rect = (element) => {
              const r = element.getBoundingClientRect();
              return {
                left: r.left,
                right: r.right,
                top: r.top,
                bottom: r.bottom,
              };
            };
            return {
              poster: rect(
                document.querySelector('[data-story-scene-layer] img'),
              ),
              protected: [
                ...document.querySelectorAll(
                  '.santa-history-fixture,.santa-history-composer,.santa-history-add,.santa-history-model,.santa-history-starters,.santa-history-welcome h1',
                ),
              ]
                .filter((node) => node.checkVisibility())
                .map(rect),
            };
          });
          assert.ok(
            boxes.protected.every(
              (box) =>
                boxes.poster.left >= box.right ||
                boxes.poster.right <= box.left ||
                boxes.poster.top >= box.bottom ||
                boxes.poster.bottom <= box.top,
            ),
          );
          assert.equal(await page.locator(RENDERER).count(), 0);
          assert.equal(await page.locator(COPY).count(), 0);
          assert.equal(
            requests.some((url) => /\/lottie_light[^/]*\.js(?:\?|$)/.test(url)),
            false,
          );
          assert.match(
            await page.locator('body').innerText(),
            /Data requests: 0/,
          );
          await page.keyboard.press('Escape');
          await empty(page);
          assertHost(await hostState(page));
          assert.deepEqual(errors, []);
          await save(`reduced-${width}.json`, {
            width,
            boxes,
            errors,
            limitation:
              'This fixture has a safe readable poster slot. Notification-only behaviour under no available slot is covered separately by focused component/geometry tests.',
          });
        } finally {
          await context.close();
        }
      }),
  );
}

const resourceState = async (page, cdp) => {
  await page.waitForTimeout(100);
  let listeners = 0;
  for (const expression of ['window', 'document', 'window.visualViewport']) {
    const { result } = await cdp.send('Runtime.evaluate', {
      expression,
      objectGroup: 'history-listeners',
    });
    if (result.objectId)
      listeners += (
        await cdp.send('DOMDebugger.getEventListeners', {
          objectId: result.objectId,
        })
      ).listeners.length;
  }
  await cdp.send('Runtime.releaseObjectGroup', {
    objectGroup: 'history-listeners',
  });
  return {
    ...(await page.evaluate(() => window.historyResources())),
    listeners,
    ...(await heapAndDetached(cdp)),
    cdp: await cdp.send('Memory.getDOMCounters'),
  };
};

test(
  '20 real-clock borrowed replays release copies players observers listeners and timers',
  { timeout: 150000 },
  () =>
    withBrowser(async (browser, base) => {
      const { context, page, cdp, errors } = await open(browser, base, 1280);
      try {
        await start(page);
        await cancel(page);
        /* Warm the same allocations and style mutation before comparing retention. */
        for (let run = 0; run < 3; run++) {
          await rememberHost(page);
          const zero = await replay(page);
          await borrowed(page, zero);
          await interrupt(page, run === 0 ? 'row geometry' : 'input');
          await empty(page);
          await restoreMutation(page, run === 0 ? 'row geometry' : 'input');
        }
        await page
          .getByRole('textbox', { name: 'Message' })
          .evaluate((node) => {
            node.focus();
            node.setSelectionRange(3, 11);
          });
        await rememberHost(page);
        const baseline = await resourceState(page, cdp);
        const events = [
          'pointerdown',
          'keydown',
          'beforeinput',
          'input',
          'compositionstart',
          'scroll',
          'resize',
          'visual resize',
          'visual scroll',
          'row geometry',
        ];
        const runs = [];
        for (let run = 0; run < 20; run++) {
          const zero = await replay(page);
          await borrowed(page, zero);
          const event = events[run % events.length];
          await interrupt(page, event);
          await empty(page);
          await restoreMutation(page, event);
          assertHost(await hostState(page));
          const after = await resourceState(page, cdp);
          for (const name of [
            'players',
            'snapshots',
            'sceneNodes',
            'webAnimations',
          ])
            assert.equal(after[name], 0, `${event}: ${name}`);
          for (const name of [
            'timeouts',
            'intervals',
            'animationFrames',
            'mutationObservers',
            'resizeObservers',
            'listeners',
          ])
            assert.ok(
              after[name] <= baseline[name],
              `${event}: ${name} ${after[name]} > ${baseline[name]}`,
            );
          assert.equal(after.liveDocumentNodes, baseline.liveDocumentNodes);
          runs.push({ run: run + 1, event, ...after });
        }
        const final = runs.at(-1);
        assert.notEqual(final.detachedSvgNodes, null);
        assert.ok(final.detachedSvgNodes <= baseline.detachedSvgNodes);
        const counts = await page.evaluate(() => ({
          created: window.historyEvidence.created,
          destroyed: window.historyEvidence.destroyed,
        }));
        assert.equal(counts.created, counts.destroyed);
        await checkCache(page);
        assert.deepEqual(errors, []);
        await save('retention-20.json', {
          baseline,
          runs,
          counts,
          errors,
          heapGrowthBytes: final.heapUsedBytes - baseline.heapUsedBytes,
          limitation:
            'Each of20 replays advances on the real clock until one live row is visibly borrowed, then cancels. These are cancellation-retention cycles, not20 full-story completion or artistic assessments. Four separate tests cover normal27-second completion. Heap and detached-DOM diagnostics include Storybook/V8; no claim of zero retained application objects.',
        });
      } finally {
        await context.close();
      }
    }),
);

test(
  'late ignored-abort data cannot revive a cancelled activation',
  { timeout: 15000 },
  () =>
    withBrowser(async (browser, base) => {
      const { context, page, errors } = await open(browser, base, 1280, {
        loader: 'ignores-abort',
      });
      try {
        await page.getByRole('textbox', { name: 'Message' }).focus();
        await page.waitForTimeout(1600);
        await empty(page);
        assert.equal(await page.locator(COPY).count(), 0);
        assert.equal(await page.locator(RENDERER).count(), 0);
        assert.equal(await page.locator(`${LAYER} img`).count(), 0);
        assert.deepEqual(errors, []);
        await save('late-data.json', {
          errors,
          outcome:
            'cancelled activation remained empty after ignored-abort loader resolved',
        });
      } finally {
        await context.close();
      }
    }),
);

test('pinned local full-story bytes remained unchanged throughout the run', async () => {
  for (const [file, bytes] of sourceBytes)
    assert.deepEqual(
      await readFile(resolve(fixtureDirectory, file)),
      bytes,
      file,
    );
  await save('source-integrity.json', {
    unchanged: true,
    playbackMs: PLAYBACK_MS,
  });
});
