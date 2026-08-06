import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createServeStaticOptions,
  OVERLAY_SANDBOX_ROUTE,
  resolveFrontendRootPath,
  resolveOverlaySandboxRootPath,
} from '../static-assets';

const CHAT_INDEX_HTML =
  '<!doctype html><html><body><div id="root"></div></body></html>';
const SANDBOX_INDEX_HTML =
  '<!doctype html><html><body><div id="sandbox-root"></div></body></html>';

@Controller('api/ping')
class ApiPingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

const createStaticTestModule = (
  frontendRootPath: string,
  overlaySandboxRootPath: string,
  overlaySandboxEnabled = false,
) => {
  @Module({
    imports: [
      ServeStaticModule.forRoot(
        ...createServeStaticOptions({
          frontendRootPath,
          overlaySandboxRootPath,
          overlaySandboxEnabled,
        }),
      ),
    ],
    controllers: [ApiPingController],
  })
  class StaticTestModule {}

  return StaticTestModule;
};

const createStaticTestApp = async (
  frontendRootPath: string,
  overlaySandboxRootPath: string,
  overlaySandboxEnabled = false,
): Promise<INestApplication> => {
  const app = await NestFactory.create(
    createStaticTestModule(
      frontendRootPath,
      overlaySandboxRootPath,
      overlaySandboxEnabled,
    ),
    { logger: false },
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

    expect(response.text).toBe(CHAT_INDEX_HTML);
  });

  it('serves index.html for client-side routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/conversations/thread-1')
      .expect(200);

    expect(response.text).toBe(CHAT_INDEX_HTML);
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
    expect(rootResponse.text).toBe(SANDBOX_INDEX_HTML);

    const clientRouteResponse = await request(app.getHttpServer())
      .get(`${OVERLAY_SANDBOX_ROUTE}/case/direct`)
      .expect(200);
    expect(clientRouteResponse.text).toBe(SANDBOX_INDEX_HTML);
  });

  it('does not serve index.html for API routes', async () => {
    await request(app.getHttpServer())
      .get('/api/ping')
      .expect(200, { ok: true });

    await request(app.getHttpServer()).get('/api/missing').expect(404);
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
});
