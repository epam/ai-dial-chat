import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BucketService } from '../auth/bucket/bucket.service';
import { RefreshService } from '../auth/refresh/refresh.service';
import { SessionGuard } from '../auth/session/session.guard';
import { SessionService } from '../auth/session/session.service';
import { AUTH_STRATEGIES } from '../auth/strategies/auth-strategies.token';
import { CookieSessionStrategy } from '../auth/strategies/cookie-session.strategy';
import { HealthController } from './health.controller';

// supertest is CJS; use require to avoid vite ESM interop issues
const request = require('supertest') as (
  app: Parameters<typeof import('supertest')>[0],
) => import('supertest').SuperTest<import('supertest').Test>;

describe('HealthController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /health includes a non-empty buildId', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.buildId).toBeTruthy();
  });

  it('GET /health returns the same buildId across repeated calls', async () => {
    const first = await request(app.getHttpServer()).get('/health').expect(200);
    const second = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(second.body.buildId).toBe(first.body.buildId);
  });

  describe('with global SessionGuard', () => {
    let guardedApp: INestApplication;

    beforeEach(async () => {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          // decryptFromRequest always throws — any non-public route returns 401
          {
            provide: SessionService,
            useValue: {
              decryptFromRequest: vi
                .fn()
                .mockRejectedValue(new Error('no session')),
              encrypt: vi.fn(),
            },
          },
          { provide: RefreshService, useValue: { refresh: vi.fn() } },
          { provide: BucketService, useValue: { getUserBucket: vi.fn() } },
          { provide: ConfigService, useValue: { get: vi.fn() } },
          CookieSessionStrategy,
          {
            provide: AUTH_STRATEGIES,
            useFactory: (cookieStrategy: CookieSessionStrategy) => [
              cookieStrategy,
            ],
            inject: [CookieSessionStrategy],
          },
          { provide: APP_GUARD, useClass: SessionGuard },
        ],
      }).compile();

      guardedApp = moduleFixture.createNestApplication();
      await guardedApp.init();
    });

    afterEach(async () => {
      await guardedApp.close();
    });

    it('GET /health is accessible without a session cookie (@Public)', async () => {
      await request(guardedApp.getHttpServer()).get('/health').expect(200);
    });
  });
});
