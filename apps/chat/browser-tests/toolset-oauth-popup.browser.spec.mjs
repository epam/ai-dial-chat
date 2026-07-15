import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { chromium } from 'playwright';

const listen = (server) =>
  new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });

const close = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });

let appOrigin;
let browser;
let providerOrigin;

const appServer = createServer((request, response) => {
  if (request.url?.startsWith('/callback')) {
    response.setHeader('Content-Type', 'text/html');
    response.end(`<!doctype html>
      <script>
        const params = new URLSearchParams(location.search);
        const redirectState = JSON.parse(
          sessionStorage.getItem('toolset-redirect-state') ?? 'null',
        );
        const channel = new BroadcastChannel(
          'toolset-oauth-' + params.get('state'),
        );
        channel.postMessage({
          type: 'success',
          storedState: redirectState,
          openerIsNull: window.opener === null,
        });
        channel.close();
        window.close();
      </script>`);
    return;
  }

  response.setHeader('Content-Type', 'text/html');
  response.end('<!doctype html><title>OAuth opener</title>');
});

const providerServer = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', providerOrigin);
  const state = requestUrl.searchParams.get('state');
  response.writeHead(302, {
    Location: `${appOrigin}/callback?code=browser-code&state=${encodeURIComponent(state ?? '')}`,
  });
  response.end();
});

before(async () => {
  const appPort = await listen(appServer);
  appOrigin = `http://127.0.0.1:${appPort}`;
  const providerPort = await listen(providerServer);
  providerOrigin = `http://127.0.0.1:${providerPort}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await Promise.all([close(appServer), close(providerServer)]);
});

test('keeps popup-local state across the provider round trip and reports through BroadcastChannel without an opener', async () => {
  const page = await browser.newPage();
  await page.goto(appOrigin);

  const flowId = 'browser-flow-id';
  const resultPromise = page.evaluate(
    ({ flowId: id, providerUrl }) =>
      new Promise((resolve, reject) => {
        const channel = new BroadcastChannel(`toolset-oauth-${id}`);
        const timeoutId = window.setTimeout(() => {
          channel.close();
          reject(new Error('OAuth callback result timed out'));
        }, 5_000);

        channel.onmessage = (event) => {
          window.clearTimeout(timeoutId);
          channel.close();
          resolve(event.data);
        };

        const popup = window.open('', '_blank');
        if (!popup) {
          reject(new Error('Browser blocked the test popup'));
          return;
        }

        popup.sessionStorage.setItem(
          'toolset-redirect-state',
          JSON.stringify({ toolsetId: 'toolsets/b/test__1', state: id }),
        );
        popup.opener = null;
        popup.location.href = `${providerUrl}/authorize?state=${encodeURIComponent(id)}`;
      }),
    { flowId, providerUrl: providerOrigin },
  );

  await assert.doesNotReject(resultPromise);
  const result = await resultPromise;
  assert.deepEqual(result, {
    type: 'success',
    storedState: {
      toolsetId: 'toolsets/b/test__1',
      state: flowId,
    },
    openerIsNull: true,
  });

  await page.close();
});
