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
  resolveFrontendRootPath,
} from '../static-assets';

const INDEX_HTML =
  '<!doctype html><html><body><div id="root"></div></body></html>';

@Controller('api/ping')
class ApiPingController {
  @Get()
  ping() {
    return { ok: true };
  }
}

const createStaticTestModule = (rootPath: string) => {
  @Module({
    imports: [ServeStaticModule.forRoot(createServeStaticOptions(rootPath))],
    controllers: [ApiPingController],
  })
  class StaticTestModule {}

  return StaticTestModule;
};

describe('static assets serving', () => {
  let app: INestApplication;
  let staticRoot: string;

  beforeEach(async () => {
    staticRoot = await mkdtemp(join(tmpdir(), 'chat-static-'));
    await mkdir(join(staticRoot, 'assets'));
    await writeFile(join(staticRoot, 'index.html'), INDEX_HTML);
    await writeFile(
      join(staticRoot, 'assets', 'app.js'),
      'console.log("app");',
    );

    app = await NestFactory.create(createStaticTestModule(staticRoot), {
      logger: false,
    });
    await app.init();
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app.close();
    await rm(staticRoot, { recursive: true, force: true });
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
        (candidate) => candidate === frontendDist,
      ),
    ).toBe(frontendDist);
  });

  it('serves index.html for the root route', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.text).toBe(INDEX_HTML);
  });

  it('serves index.html for client-side routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/conversations/thread-1')
      .expect(200);

    expect(response.text).toBe(INDEX_HTML);
  });

  it('does not serve index.html for API routes', async () => {
    await request(app.getHttpServer())
      .get('/api/ping')
      .expect(200, { ok: true });

    await request(app.getHttpServer()).get('/api/missing').expect(404);
  });
});
