import { collectStartupResponses } from './startup-requests.mjs';
import { createServer } from 'http';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import { gzipSync } from 'zlib';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { cleanupDir, createFixtureDependencyResolver } from './harness.mjs';
import {
  assertApplicationBudget,
  matchesForbiddenOrigin,
  HARD_EXCLUDED_MODULE_MARKERS,
  buildPackedFixture,
  buildSourceFixture,
  DEFERRED_FEATURES,
  writeAppShellHtml,
} from './application-mode.mjs';
const MAX_PACKED_VS_SOURCE_RATIO = 1.2;
const APP_READY_TIMEOUT_MS = 20000;
const CONTENT_TYPES = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
};
const serveDir = (rootDir) =>
  new Promise((resolve) => {
    const server = createServer((req, res) => {
      const urlPath = decodeURIComponent(
        new URL(req.url, 'http://127.0.0.1').pathname,
      );
      const filePath = path.join(
        rootDir,
        urlPath === '/' ? 'index.html' : urlPath,
      );
      try {
        const body = readFileSync(filePath);
        const contentType =
          CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
const closeServer = (server) => new Promise((resolve) => server.close(resolve));
export const measureInBrowser = async (fixture) => {
  writeAppShellHtml(fixture.outDir);
  const server = await serveDir(fixture.outDir);
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = [];
    const errors = [];
    page.on('request', (request) => requests.push(request));
    page.on('pageerror', (error) => errors.push(error.message));
    const responses = [];
    page.on('response', (response) => {
      responses.push(response);
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, {
      waitUntil: 'load',
    });
    await page.waitForSelector('#app-marker[data-app-ready="true"]', {
      state: 'attached',
      timeout: APP_READY_TIMEOUT_MS,
    });
    const readyAt = await page.evaluate(() => globalThis.__appReadyAt);
    // Snapshot requests, then await their responses: late responses retain their startup cost.
    const preMarkerResponses = await collectStartupResponses(
      requests.slice(),
      readyAt,
    );
    const preMarkerJsCss = preMarkerResponses.filter((r) =>
      /\.(js|css)$/.test(new URL(r.url()).pathname),
    );
    const bodies = await Promise.all(preMarkerJsCss.map((r) => r.body()));
    const isJs = preMarkerJsCss.map((r) =>
      new URL(r.url()).pathname.endsWith('.js'),
    );
    const sum = (predicate) =>
      bodies.reduce(
        (total, body, i) =>
          predicate(i)
            ? {
                raw: total.raw + body.length,
                gzip: total.gzip + gzipSync(body).length,
              }
            : total,
        { raw: 0, gzip: 0 },
      );
    const preMarkerJs = sum((i) => isJs[i]);
    const preMarkerCss = sum((i) => !isJs[i]);
    const assetResponses = preMarkerResponses.filter(
      (r) => !/\.(js|css|html)$/.test(new URL(r.url()).pathname),
    );
    const assetBodies = await Promise.all(assetResponses.map((r) => r.body()));
    const initialAssets = assetBodies.reduce(
      (sum, body) => ({
        raw: sum.raw + body.length,
        gzip: sum.gzip + gzipSync(body).length,
      }),
      { raw: 0, gzip: 0 },
    );
    assertApplicationBudget({
      initialJs: preMarkerJs,
      initialCss: preMarkerCss,
      initialAssets,
    });
    const origins = JSON.parse(
      readFileSync(path.join(fixture.outDir, 'module-origins.json'), 'utf8'),
    );
    const loadedOrigins = preMarkerJsCss
      .filter((r) => r.url().split('?')[0].endsWith('.js'))
      .flatMap((r) => {
        const file = new URL(r.url()).pathname.slice(1);
        if (!origins[file])
          throw new Error('Missing browser chunk provenance: ' + file);
        return Object.entries(origins[file])
          .filter(([, bytes]) => bytes > 0)
          .map(([id]) => id);
      });
    const forbidden = matchesForbiddenOrigin(
      { initialModuleOrigins: loadedOrigins },
      HARD_EXCLUDED_MODULE_MARKERS,
    );
    if (forbidden.length)
      throw new Error(
        'Forbidden browser startup origins: ' + forbidden.join(', '),
      );
    const preMarkerUrls = new Set(preMarkerResponses.map((r) => r.url()));
    const featureResults = {};
    for (const feature of DEFERRED_FEATURES) {
      // Each feature gets a cold document so another feature cannot warm its shared chunks.
      responses.length = 0;
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('#app-marker[data-app-ready="true"]', {
        timeout: APP_READY_TIMEOUT_MS,
      });
      const allUrlsBeforeThisOpen = new Set(responses.map((r) => r.url()));
      const firstResponsePromise = page
        .waitForResponse(
          (r) =>
            /\.js$/.test(new URL(r.url()).pathname) &&
            !allUrlsBeforeThisOpen.has(r.url()),
          { timeout: 10000 },
        )
        .catch(() => null);
      await page.evaluate((opener) => globalThis[opener](), feature.opener);
      const firstResponse = await firstResponsePromise;
      await page.waitForSelector('#' + feature.root + '-feature-root > *', {
        timeout: 10000,
      });
      const box = await page
        .locator('#' + feature.root + '-feature-root')
        .boundingBox();
      if (!box || box.width <= 0 || box.height <= 0)
        throw new Error('Feature has no layout: ' + feature.key);
      await page.evaluate(
        (key) => globalThis.__closeFeature(key),
        feature.root,
      );
      let reopenDuplicateFetch = false;
      if (firstResponse) {
        const countBeforeReopen = responses.filter(
          (r) => r.url() === firstResponse.url(),
        ).length;
        await page.evaluate((opener) => globalThis[opener](), feature.opener);
        await page.waitForTimeout(250);
        const countAfterReopen = responses.filter(
          (r) => r.url() === firstResponse.url(),
        ).length;
        reopenDuplicateFetch = countAfterReopen > countBeforeReopen;
      }
      featureResults[feature.key] = {
        label: feature.label,
        requestedBeforeMarker: firstResponse
          ? preMarkerUrls.has(firstResponse.url())
          : false,
        reachableAfterOpen: firstResponse !== null,
        reopenDuplicateFetch,
      };
    }
    const oauthEventsBeforeOpen = await page.evaluate(
      () => globalThis.__oauthIdentityEvents.length,
    );
    await page.evaluate(() => globalThis.__openOAuthAndEmit());
    await page.waitForFunction(
      () => globalThis.__oauthIdentityEvents.length > 0,
      { timeout: 10000 },
    );
    const oauthEventsAfterOpen = await page.evaluate(
      () => globalThis.__oauthIdentityEvents,
    );
    if (errors.length)
      throw new Error('Browser runtime errors: ' + errors.join('; '));
    return {
      preMarkerJs,
      preMarkerCss,
      preMarkerRequestCount: preMarkerJsCss.length,
      featureResults,
      oauthIdentity: {
        eventsBeforeOpen: oauthEventsBeforeOpen,
        eventsAfterOpen: oauthEventsAfterOpen,
      },
    };
  } finally {
    await browser.close();
    await closeServer(server);
  }
};
export const checkMarkdownReloadAndAssets = async (fixture) => {
  writeAppShellHtml(fixture.outDir);
  const server = await serveDir(fixture.outDir);
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const cssResponses = [];
    page.on('response', (response) => {
      if (/\.css$/.test(new URL(response.url()).pathname))
        cssResponses.push(response);
    });
    let abortedOnce = false;
    await page.route('**/*.js', (route) => {
      const isLikelyMarkdownChunk = /markdown/i.test(route.request().url());
      if (isLikelyMarkdownChunk && !abortedOnce) {
        abortedOnce = true;
        return route.abort('failed');
      }
      return route.continue();
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, {
      waitUntil: 'load',
    });
    await page.waitForSelector('#app-marker[data-app-ready="true"]', {
      state: 'attached',
      timeout: APP_READY_TIMEOUT_MS,
    });
    const firstAttemptRejected = await page.evaluate(() =>
      globalThis
        .__openMarkdownFeature()
        .then(() => false)
        .catch(() => true),
    );
    await page.unroute('**/*.js');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#app-marker[data-app-ready="true"]', {
      state: 'attached',
      timeout: APP_READY_TIMEOUT_MS,
    });
    const cssCountBeforeReopen = cssResponses.length;
    const secondAttemptSucceeded = await page.evaluate(() =>
      globalThis
        .__openMarkdownFeature()
        .then(() => true)
        .catch(() => false),
    );
    const mathRendered = await page
      .waitForFunction(
        () => document.querySelector('#markdown-feature-root .katex') !== null,
        { timeout: 10000 },
      )
      .then(() => true)
      .catch(() => false);
    await page.waitForTimeout(250);
    return {
      abortedOnce,
      firstAttemptRejected,
      secondAttemptSucceeded,
      mathRendered,
      cssFetched: cssResponses.length > cssCountBeforeReopen,
      consoleErrors,
    };
  } finally {
    await browser.close();
    await closeServer(server);
  }
};
export const checkMobileRtlRender = async (fixture) => {
  writeAppShellHtml(fixture.outDir);
  const shellHtmlPath = path.join(fixture.outDir, 'index.html');
  writeFileSync(
    shellHtmlPath,
    readFileSync(shellHtmlPath, 'utf8').replace(
      '<html>',
      '<html dir="rtl" lang="ar">',
    ),
  );
  const server = await serveDir(fixture.outDir);
  const { port } = server.address();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 375, height: 812 },
    });
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, {
      waitUntil: 'load',
    });
    await page.waitForSelector('#app-marker[data-app-ready="true"]', {
      state: 'attached',
      timeout: APP_READY_TIMEOUT_MS,
    });
    await page.evaluate(() => globalThis.__openMarkdownFeature());
    await page.waitForFunction(
      () => document.querySelector('#markdown-feature-root .katex') !== null,
      { timeout: 10000 },
    );
    const box = await page.locator('#markdown-feature-root').boundingBox();
    const debugInfo = await page.evaluate(() => ({
      htmlDirAttr: document.documentElement.getAttribute('dir'),
      htmlComputedDirection: getComputedStyle(document.documentElement)
        .direction,
      rootComputedDirection: getComputedStyle(
        document.getElementById('markdown-feature-root'),
      ).direction,
    }));
    return {
      rendered: box !== null && box.width > 0 && box.height > 0,
      computedDirection: debugInfo.rootComputedDirection,
      debugInfo,
      consoleErrors,
    };
  } finally {
    await browser.close();
    await closeServer(server);
  }
};
const formatBytes = ({ raw, gzip }) => `${raw} B raw / ${gzip} B gzip`;
const ratioOf = (packedBytes, sourceBytes) =>
  sourceBytes === 0
    ? packedBytes === 0
      ? 1
      : Infinity
    : packedBytes / sourceBytes;
const here = path.dirname(fileURLToPath(import.meta.url));
const chatHooksRoot = path.resolve(here, '..');
const workspaceRoot = path.resolve(chatHooksRoot, '..', '..');
const tmpRoot = mkdtempSync(
  path.join(os.tmpdir(), 'ai-dial-chat-browser-parity-fixtures-'),
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
const main = async () => {
  console.info(
    'Building source-mode application fixture (libs/*/src aliases, React bundled)...',
  );
  const source = buildSourceFixture({ workspaceRoot, tmpRoot });
  if (!source.pass) {
    console.error('FAIL  source fixture failed to build:\n' + source.output);
    if (!keepFixtures) cleanupDir(tmpRoot);
    process.exit(1);
  }
  console.info(
    'Packing the four in-scope packages and building the packed application fixture...',
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
  console.info('\nLoading source fixture in headless Chromium...');
  const sourceBrowser = await measureInBrowser(source);
  console.info(
    `  pre-marker JS: ${formatBytes(sourceBrowser.preMarkerJs)} (${sourceBrowser.preMarkerRequestCount} JS/CSS requests)`,
  );
  console.info(`  pre-marker CSS: ${formatBytes(sourceBrowser.preMarkerCss)}`);
  console.info('\nLoading packed fixture in headless Chromium...');
  const packedBrowser = await measureInBrowser(packed);
  console.info(
    `  pre-marker JS: ${formatBytes(packedBrowser.preMarkerJs)} (${packedBrowser.preMarkerRequestCount} JS/CSS requests)`,
  );
  console.info(`  pre-marker CSS: ${formatBytes(packedBrowser.preMarkerCss)}`);
  const rawJsRatio = ratioOf(
    packedBrowser.preMarkerJs.raw,
    sourceBrowser.preMarkerJs.raw,
  );
  const gzipJsRatio = ratioOf(
    packedBrowser.preMarkerJs.gzip,
    sourceBrowser.preMarkerJs.gzip,
  );
  const rawJsPass = rawJsRatio <= MAX_PACKED_VS_SOURCE_RATIO;
  const gzipJsPass = gzipJsRatio <= MAX_PACKED_VS_SOURCE_RATIO;
  const featureChecks = DEFERRED_FEATURES.map((feature) => {
    const src = sourceBrowser.featureResults[feature.key];
    const pkd = packedBrowser.featureResults[feature.key];
    return {
      key: feature.key,
      label: feature.label,
      exclusionPass: !src.requestedBeforeMarker && !pkd.requestedBeforeMarker,
      reachablePass: src.reachableAfterOpen && pkd.reachableAfterOpen,
      reopenPass: !src.reopenDuplicateFetch && !pkd.reopenDuplicateFetch,
    };
  });
  const allFeatureChecksPass = featureChecks.every(
    (c) => c.exclusionPass && c.reachablePass && c.reopenPass,
  );
  const oauthIdentityPass = [sourceBrowser, packedBrowser].every(
    (b) =>
      b.oauthIdentity.eventsBeforeOpen === 0 &&
      b.oauthIdentity.eventsAfterOpen.length === 1 &&
      b.oauthIdentity.eventsAfterOpen[0].toolsetId === 'browser-parity-fixture',
  );
  console.info(
    '\nRunning markdown reload recovery + CSS/font check (source fixture)...',
  );
  const sourceRetry = await checkMarkdownReloadAndAssets(source);
  console.info(
    '  ' +
      JSON.stringify({
        ...sourceRetry,
        consoleErrors: sourceRetry.consoleErrors.slice(0, 3),
      }),
  );
  console.info(
    '\nRunning markdown retry-after-failure + CSS/font check (packed fixture)...',
  );
  const packedRetry = await checkMarkdownReloadAndAssets(packed);
  console.info(
    '  ' +
      JSON.stringify({
        ...packedRetry,
        consoleErrors: packedRetry.consoleErrors.slice(0, 3),
      }),
  );
  const isExpectedAbortError = (text) => text.includes('net::ERR_FAILED');
  const retryPass = [sourceRetry, packedRetry].every(
    (r) =>
      r.abortedOnce &&
      r.firstAttemptRejected &&
      r.secondAttemptSucceeded &&
      r.mathRendered &&
      r.cssFetched &&
      r.consoleErrors.every(isExpectedAbortError),
  );
  console.info(
    '\nRunning mobile/RTL markdown render check (source fixture)...',
  );
  const sourceRtl = await checkMobileRtlRender(source);
  console.info(
    '  ' +
      JSON.stringify({
        ...sourceRtl,
        consoleErrors: sourceRtl.consoleErrors.slice(0, 3),
      }),
  );
  console.info(
    '\nRunning mobile/RTL markdown render check (packed fixture)...',
  );
  const packedRtl = await checkMobileRtlRender(packed);
  console.info(
    '  ' +
      JSON.stringify({
        ...packedRtl,
        consoleErrors: packedRtl.consoleErrors.slice(0, 3),
      }),
  );
  const mobileRtlPass = [sourceRtl, packedRtl].every(
    (r) =>
      r.rendered &&
      r.computedDirection === 'rtl' &&
      r.consoleErrors.length === 0,
  );
  console.info('\n--- Summary ---');
  console.info(
    `${rawJsPass ? 'PASS' : 'FAIL'}  browser-observed pre-marker JS (raw) within ${MAX_PACKED_VS_SOURCE_RATIO}x of source (${rawJsRatio.toFixed(3)})`,
  );
  console.info(
    `${gzipJsPass ? 'PASS' : 'FAIL'}  browser-observed pre-marker JS (gzip) within ${MAX_PACKED_VS_SOURCE_RATIO}x of source (${gzipJsRatio.toFixed(3)})`,
  );
  for (const c of featureChecks) {
    console.info(
      `${c.exclusionPass ? 'PASS' : 'FAIL'}  ${c.label}: chunk not requested before first usable render`,
    );
    console.info(
      `${c.reachablePass ? 'PASS' : 'FAIL'}  ${c.label}: chunk is genuinely reachable once opened`,
    );
    console.info(
      `${c.reopenPass ? 'PASS' : 'FAIL'}  ${c.label}: reopen does not re-fetch the chunk`,
    );
  }
  console.info(
    `${oauthIdentityPass ? 'PASS' : 'FAIL'}  OAuth root-subscription/subpath-emit share one EventTarget singleton, inert until ./oauth is opened`,
  );
  console.info(
    `${retryPass ? 'PASS' : 'FAIL'}  markdown feature recovers after a simulated failed chunk fetch (full-page reload), CSS/font asset fetched, math renders`,
  );
  console.info(
    `${mobileRtlPass ? 'PASS' : 'FAIL'}  markdown feature renders under a mobile viewport with dir="rtl" (computed direction: source=${sourceRtl.computedDirection}, packed=${packedRtl.computedDirection})`,
  );
  if (!keepFixtures) {
    cleanupDir(tmpRoot);
  } else {
    console.info(`\nKEEP_FIXTURES=1 set — fixtures left at: ${tmpRoot}`);
  }
  const overallPass =
    rawJsPass &&
    gzipJsPass &&
    allFeatureChecksPass &&
    oauthIdentityPass &&
    retryPass &&
    mobileRtlPass;
  if (!overallPass) {
    console.error('\nBrowser-observed application-mode parity check failed.');
    process.exit(1);
  }
  console.info('\nBrowser-observed application-mode parity check passed.');
};
if (path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
