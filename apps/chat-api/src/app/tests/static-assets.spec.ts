import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  Controller,
  Get,
  INestApplication,
  Logger,
  Module,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createHelmetOptions,
  CspMode,
  CSP_NONCE_PLACEHOLDER,
} from '../../config/csp';
import {
  createFrontendMiddleware,
  OVERLAY_SANDBOX_ROUTE,
  resolveFrontendRootPath,
  resolveOverlaySandboxRootPath,
} from '../static-assets';

const CHAT_INDEX_HTML = `<!doctype html><html><head><meta property="csp-nonce" nonce="${CSP_NONCE_PLACEHOLDER}"></head><body><div id="root"></div></body></html>`;
const SANDBOX_INDEX_HTML = `<!doctype html><html><head><meta property="csp-nonce" nonce="${CSP_NONCE_PLACEHOLDER}"></head><body><div id="sandbox-root"></div></body></html>`;

const withoutNonce = (html: string): string =>
  html.replace(/nonce="[^"]+"/, `nonce="${CSP_NONCE_PLACEHOLDER}"`);

@Controller('api/ping')
class ApiPingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

@Module({ controllers: [ApiPingController] })
class StaticTestModule {}

const createStaticTestApp = async (
  frontendRootPath: string,
  overlaySandboxRootPath: string,
  overlaySandboxEnabled = false,
  cspMode = CspMode.Enforce,
  reportUri?: string,
  allowedConnectOrigins: string[] = [],
): Promise<INestApplication> => {
  const app = await NestFactory.create(StaticTestModule, { logger: false });
  /* The app declarations use Helmet's CJS types; Vitest resolves its ESM types. */
  app.use(
    helmet(createHelmetOptions([], false) as Parameters<typeof helmet>[0]),
  );
  app.use(
    await createFrontendMiddleware({
      frontendRootPath,
      overlaySandboxRootPath,
      overlaySandboxEnabled,
      secureTransport: false,
      cspMode,
      reportUri,
      allowedConnectOrigins,
    }),
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  return app;
};

describe('static assets serving', () => {
  let app: INestApplication;
  let staticRoot: string;
  let overlaySandboxRoot: string;

  beforeEach(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'chat-static-'));
    await mkdir(join(staticRoot, 'assets'));
    await writeFile(join(staticRoot, 'index.html'), CHAT_INDEX_HTML);
    await writeFile(
      join(staticRoot, 'assets', 'app.js'),
      'console.log("app");',
    );

    overlaySandboxRoot = await mkdtemp(join(tmpdir(), 'overlay-sandbox-'));
    await mkdir(join(overlaySandboxRoot, 'assets'));
    await writeFile(join(overlaySandboxRoot, 'index.html'), SANDBOX_INDEX_HTML);
    await writeFile(
      join(overlaySandboxRoot, 'assets', 'sandbox.js'),
      'console.log("sandbox");',
    );

    app = await createStaticTestApp(staticRoot, overlaySandboxRoot);
  });

  afterEach(async () => {
    await app.close();
    await rm(staticRoot, { recursive: true, force: true });
    await rm(overlaySandboxRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it.each([CspMode.Enforce, CspMode.ReportOnly])(
    'allows external document fetches in every HTML policy in %s mode',
    async (mode) => {
      await app.close();
      const origin = 'https://documents.example.com';
      app = await createStaticTestApp(
        staticRoot,
        overlaySandboxRoot,
        true,
        mode,
        undefined,
        [origin],
      );

      for (const path of ['/', '/conversation/123', '/overlay-sandbox/']) {
        const response = await request(app.getHttpServer())
          .get(path)
          .expect(200);
        const policies = [response.headers['content-security-policy']];
        if (mode === CspMode.ReportOnly) {
          policies.push(
            response.headers['content-security-policy-report-only'],
          );
        }
        for (const policy of policies) {
          const directives = policy.split(';');
          expect(directives).toContain(`connect-src 'self' blob: ${origin}`);
          expect(directives).toContain("frame-src 'self'");
          expect(directives).toContain("frame-ancestors 'none'");
          expect(
            directives.find((directive: string) =>
              directive.startsWith('script-src '),
            ),
          ).not.toContain(origin);
        }
      }
    },
  );

  it('keeps external connections blocked when no origins are configured', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);
    expect(response.headers['content-security-policy'].split(';')).toContain(
      "connect-src 'self' blob:",
    );
  });

  it('resolves the built React app from source modules', () => {
    const appsDir = join(tmpdir(), 'workspace', 'apps');

    expect(
      resolveFrontendRootPath(
        join(appsDir, 'chat-api', 'src', 'app'),
        () => false,
      ),
    ).toBe(join(appsDir, 'chat', 'dist'));
  });

  it('resolves the built React app from the bundled backend output', () => {
    const appsDir = join(tmpdir(), 'workspace', 'apps');
    const frontendDist = join(appsDir, 'chat', 'dist');

    expect(
      resolveFrontendRootPath(
        join(appsDir, 'chat-api', 'dist'),
        (candidate: string) => candidate === frontendDist,
      ),
    ).toBe(frontendDist);
  });

  it('resolves the overlay sandbox app from source modules', () => {
    const appsDir = join(tmpdir(), 'workspace', 'apps');

    expect(
      resolveOverlaySandboxRootPath(
        join(appsDir, 'chat-api', 'src', 'app'),
        () => false,
      ),
    ).toBe(join(appsDir, 'chat-overlay-sandbox', 'dist'));
  });

  it('resolves the overlay sandbox app from the bundled backend output', () => {
    const appsDir = join(tmpdir(), 'workspace', 'apps');
    const sandboxDist = join(appsDir, 'chat-overlay-sandbox', 'dist');

    expect(
      resolveOverlaySandboxRootPath(
        join(appsDir, 'chat-api', 'dist'),
        (candidate: string) => candidate === sandboxDist,
      ),
    ).toBe(sandboxDist);
  });

  it('serves index.html for the root route', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(withoutNonce(response.text)).toBe(CHAT_INDEX_HTML);
  });

  it('serves index.html for client-side routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/conversations/thread-1')
      .expect(200);

    expect(withoutNonce(response.text)).toBe(CHAT_INDEX_HTML);
  });

  it('does not serve the overlay sandbox route when the flag is disabled', async () => {
    await request(app.getHttpServer()).get(OVERLAY_SANDBOX_ROUTE).expect(404);
    await request(app.getHttpServer())
      .get(`${OVERLAY_SANDBOX_ROUTE}/`)
      .expect(404);
  });

  it('serves the overlay sandbox route when the flag is enabled', async () => {
    await app.close();
    app = await createStaticTestApp(staticRoot, overlaySandboxRoot, true);

    const rootResponse = await request(app.getHttpServer())
      .get(`${OVERLAY_SANDBOX_ROUTE}/`)
      .expect(200);
    expect(withoutNonce(rootResponse.text)).toBe(SANDBOX_INDEX_HTML);
    expect(rootResponse.headers['content-security-policy']).not.toContain(
      "'wasm-unsafe-eval'",
    );

    const clientRouteResponse = await request(app.getHttpServer())
      .get(`${OVERLAY_SANDBOX_ROUTE}/case/direct`)
      .expect(200);
    expect(withoutNonce(clientRouteResponse.text)).toBe(SANDBOX_INDEX_HTML);
  });

  it('does not serve index.html for API routes', async () => {
    await request(app.getHttpServer())
      .get('/api/ping')
      .expect(200, { ok: true });

    await request(app.getHttpServer()).get('/api/missing').expect(404);
    await request(app.getHttpServer())
      .get('/API/ping')
      .expect(200, { ok: true });
  });

  it.each([
    '/API/missing',
    '/%61pi/missing',
    '//api/missing',
    '/ASSETS/missing.js',
    '/%61ssets/missing.js',
    '/OVERLAY-SANDBOX/',
  ])('preserves reserved routes at %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(404);
  });

  it('rejects malformed URL encoding', async () => {
    await request(app.getHttpServer()).get('/%invalid').expect(400);
  });

  it('serves an existing asset with its own content type', async () => {
    const response = await request(app.getHttpServer())
      .get('/assets/app.js')
      .expect(200);

    expect(response.text).toBe('console.log("app");');
    expect(response.headers['content-type']).toContain('javascript');
  });

  it('returns 404 instead of index.html for a missing asset', async () => {
    const response = await request(app.getHttpServer())
      .get('/assets/missing-BUG96SxZ.js')
      .expect(404);

    expect(response.text).not.toBe(CHAT_INDEX_HTML);
  });

  it('returns 404 instead of the sandbox index.html for a missing overlay sandbox asset', async () => {
    await app.close();
    app = await createStaticTestApp(staticRoot, overlaySandboxRoot, true);

    const response = await request(app.getHttpServer())
      .get(`${OVERLAY_SANDBOX_ROUTE}/assets/missing-BUG96SxZ.js`)
      .expect(404);

    expect(response.text).not.toBe(SANDBOX_INDEX_HTML);
  });

  it.each([
    '/',
    '/index.html',
    '/%69ndex.html',
    '//index.html',
    '/conversations/thread-1',
  ])('serves fresh matching nonces at %s', async (path) => {
    const responses = await Promise.all([
      request(app.getHttpServer()).get(path).expect(200),
      request(app.getHttpServer()).get(path).expect(200),
    ]);
    const nonces = responses.map((response) => {
      const nonce = /nonce="([^"]+)"/.exec(response.text)?.[1];
      expect(nonce).toMatch(/^[A-Za-z0-9+/]{43}=$/);
      expect(response.headers['content-security-policy']).toContain(
        `'nonce-${nonce}'`,
      );
      expect(response.headers['content-security-policy']).not.toContain(
        "'unsafe-inline'",
      );
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers.etag).toBeUndefined();
      expect(response.headers['last-modified']).toBeUndefined();
      expect(response.text).not.toContain(CSP_NONCE_PLACEHOLDER);
      return nonce;
    });
    expect(nonces[0]).not.toBe(nonces[1]);
  });

  it('returns fresh HTML for conditional requests and matching headers for HEAD', async () => {
    await request(app.getHttpServer())
      .get('/')
      .set('If-None-Match', '*')
      .expect(200);
    await request(app.getHttpServer())
      .get('/')
      .set('If-Modified-Since', 'Wed, 01 Jan 2031 00:00:00 GMT')
      .expect(200);
    const response = await request(app.getHttpServer()).head('/').expect(200);
    expect(response.text).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-security-policy']).toContain("'nonce-");
    expect(Number(response.headers['content-length'])).toBeGreaterThan(0);
  });

  it('retains existing enforcement while reporting the candidate policy', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    await app.close();
    app = await createStaticTestApp(
      staticRoot,
      overlaySandboxRoot,
      false,
      CspMode.ReportOnly,
      'https://reports.example.com/csp',
    );
    const response = await request(app.getHttpServer()).get('/').expect(200);
    const enforced = response.headers['content-security-policy'];
    const candidate = response.headers['content-security-policy-report-only'];
    expect(enforced).toContain("'unsafe-inline'");
    expect(enforced).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(candidate).not.toContain("'unsafe-inline'");
    expect(candidate).toContain(
      `'nonce-${/nonce="([^"]+)"/.exec(response.text)?.[1]}'`,
    );
    expect(candidate).toContain('report-uri https://reports.example.com/csp');
    expect(candidate).toContain('report-to csp');
    expect(response.headers['reporting-endpoints']).toBe(
      'csp="https://reports.example.com/csp"',
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('limits WASM to chat HTML and the bundled PDF worker', async () => {
    await writeFile(
      join(staticRoot, 'assets', 'pdf.worker.min-abc123.mjs'),
      'postMessage("ready");',
    );
    for (const path of ['/', '/assets/pdf.worker.min-abc123.mjs']) {
      const response = await request(app.getHttpServer()).get(path).expect(200);
      expect(response.headers['content-security-policy']).toContain(
        "'wasm-unsafe-eval'",
      );
    }
    for (const path of ['/api/ping', '/assets/app.js']) {
      const response = await request(app.getHttpServer()).get(path).expect(200);
      expect(response.headers['content-security-policy']).not.toContain(
        "'wasm-unsafe-eval'",
      );
    }
  });

  it('rejects a stale frontend build without the nonce marker in enforce mode', async () => {
    await writeFile(join(staticRoot, 'index.html'), '<html>stale build</html>');
    await expect(
      createFrontendMiddleware({
        frontendRootPath: staticRoot,
        cspMode: CspMode.Enforce,
      }),
    ).rejects.toThrow('CSP nonce marker missing');
  });

  it('rejects a stale enabled overlay sandbox in enforce mode', async () => {
    await writeFile(
      join(overlaySandboxRoot, 'index.html'),
      '<html>stale sandbox</html>',
    );
    await expect(
      createFrontendMiddleware({
        frontendRootPath: staticRoot,
        overlaySandboxRootPath: overlaySandboxRoot,
        overlaySandboxEnabled: true,
        cspMode: CspMode.Enforce,
      }),
    ).rejects.toThrow('CSP nonce marker missing');
  });

  it.each([false, true])(
    'serves a legacy build with a startup warning in report-only mode (sandbox: %s)',
    async (sandbox) => {
      const legacyHtml =
        '<!doctype html><html><head><style>body{color:blue}</style></head><body>legacy build</body></html>';
      const rootPath = sandbox ? overlaySandboxRoot : staticRoot;
      const route = sandbox ? OVERLAY_SANDBOX_ROUTE : '';
      await writeFile(join(rootPath, 'index.html'), legacyHtml);
      await app.close();
      const warn = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      app = await createStaticTestApp(
        staticRoot,
        overlaySandboxRoot,
        sandbox,
        CspMode.ReportOnly,
        'https://reports.example.com/csp',
      );

      for (const path of [
        `${route}/`,
        `${route}/index.html`,
        `${route}/case/direct`,
      ]) {
        const response = await request(app.getHttpServer())
          .get(path)
          .expect(200);
        expect(response.text).toBe(legacyHtml);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['content-security-policy']).toContain(
          "style-src-attr 'unsafe-inline'",
        );
        expect(response.headers['content-security-policy']).toContain(
          "script-src-attr 'none'",
        );
        const scriptDirective = response.headers['content-security-policy']
          .split(';')
          .find((directive: string) => directive.startsWith('script-src '));
        expect(scriptDirective).toBe(
          sandbox
            ? "script-src 'self'"
            : "script-src 'self' 'wasm-unsafe-eval'",
        );
        const candidate =
          response.headers['content-security-policy-report-only'];
        expect(candidate).not.toContain("'unsafe-inline'");
        expect(candidate).not.toContain("'unsafe-eval'");
        expect(candidate).toContain(
          'report-uri https://reports.example.com/csp',
        );
      }
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `CSP nonce marker missing in ${join(rootPath, 'index.html')}`,
        ),
      );
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('CSP_MODE=enforce'),
      );
    },
  );

  it('allows a legacy build with a warning when CSP mode is omitted', async () => {
    await writeFile(
      join(staticRoot, 'index.html'),
      '<html>legacy build</html>',
    );
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    await expect(
      createFrontendMiddleware({ frontendRootPath: staticRoot }),
    ).resolves.toBeTypeOf('function');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
