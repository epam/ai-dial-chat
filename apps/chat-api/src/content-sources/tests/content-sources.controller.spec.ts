import {
  BadGatewayException,
  BadRequestException,
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthSource } from '../../auth/auth-source.enum';
import { CsrfGuard } from '../../auth/csrf/csrf.guard';
import { SessionGuard } from '../../auth/session/session.guard';
import type { SessionUser } from '../../auth/session/session.types';
import { AUTH_STRATEGIES } from '../../auth/strategies/auth-strategies.token';
import type { AuthStrategy } from '../../auth/strategies/auth-strategy.interface';
import { SVG_CONTENT_SECURITY_POLICY } from '../../common/utils/svg-content-security-policy';
import {
  ContentSourcesAdmissionService,
  CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT,
} from '../content-sources-admission.service';
import {
  contentSourcesCallDuration,
  ContentSourceResult,
} from '../content-sources-telemetry';
import { ContentSourcesController } from '../content-sources.controller';
import {
  ContentSourcesService,
  UpstreamCredentialsException,
} from '../content-sources.service';

const USER: SessionUser = {
  sub: 'user-1',
  providerId: 'keycloak',
  claims: {},
  at: 'access-token',
  bucket: 'bucket-1',
  csrf: 'csrf-secret',
};

class FakeHeaderStrategy implements AuthStrategy {
  readonly source = AuthSource.Header;
  supports(req: Request): boolean {
    return typeof req.headers['x-test-user'] === 'string';
  }
  async authenticate(req: Request): Promise<SessionUser | null> {
    return JSON.parse(req.headers['x-test-user'] as string) as SessionUser;
  }
}

const LISTING = {
  id: 'rn',
  title: 'Release notes',
  kind: 'directory',
  feed: {},
  webUrl: 'https://github.com/epam/x',
  documents: [{ path: 'docs/1.md', title: 'One', date: null }],
};
const DOCUMENT = {
  path: 'docs/1.md',
  title: 'One',
  date: null,
  markdown: '# One\n![x](../a.png)\n',
  webUrl: 'https://github.com/epam/x/blob/main/docs/1.md',
};

const buildApp = async (overrides: Partial<Record<string, unknown>> = {}) => {
  const service = {
    resolve: vi.fn((id: string) => {
      if (id !== 'rn') throw new NotFoundException('Unknown content source');
    }),
    listSource: vi.fn().mockResolvedValue(LISTING),
    getDocument: vi.fn().mockResolvedValue(DOCUMENT),
    getAsset: vi.fn().mockResolvedValue({
      bytes: Buffer.from('PNG'),
      contentType: 'image/png',
    }),
    ...overrides,
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [ContentSourcesController],
    providers: [
      { provide: ContentSourcesService, useValue: service },
      ContentSourcesAdmissionService,
      Reflector,
      {
        provide: ConfigService,
        useValue: { get: () => 'https://app.example.com' },
      },
      { provide: AUTH_STRATEGIES, useValue: [new FakeHeaderStrategy()] },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: CsrfGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  return { app, service };
};

const AUTH = ['x-test-user', JSON.stringify(USER)] as const;

describe('ContentSourcesController', () => {
  let app: INestApplication | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  describe('authentication', () => {
    it.each([
      '/api/v1/content-sources/rn',
      '/api/v1/content-sources/rn/document?path=docs/1.md',
      '/api/v1/content-sources/rn/asset?path=docs/a.png',
    ])('returns 401 without a session for %s', async (path) => {
      let service;
      ({ app, service } = await buildApp());
      await request(app.getHttpServer()).get(path).expect(401);
      expect(service.listSource).not.toHaveBeenCalled();
      expect(service.getDocument).not.toHaveBeenCalled();
      expect(service.getAsset).not.toHaveBeenCalled();
    });
  });

  describe('source listing', () => {
    it('returns the listing', async () => {
      ({ app } = await buildApp());
      const res = await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn')
        .set(...AUTH)
        .expect(200);
      expect(res.body).toEqual(LISTING);
      expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('returns 404 for any unconfigured id, even a malformed one', async () => {
      let service;
      ({ app, service } = await buildApp());
      for (const id of ['nope', 'Bad_ID']) {
        await request(app.getHttpServer())
          .get(`/api/v1/content-sources/${id}`)
          .set(...AUTH)
          .expect(404);
      }
      expect(service.listSource).not.toHaveBeenCalled();
    });

    it.each([
      [new BadGatewayException('x'), 502],
      [new ServiceUnavailableException('x'), 503],
      [new NotFoundException('x'), 404],
    ])('passes through %s as %i', async (error, status) => {
      ({ app } = await buildApp({
        listSource: vi.fn().mockRejectedValue(error),
      }));
      await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn')
        .set(...AUTH)
        .expect(status);
    });
  });

  describe('document', () => {
    it('returns the document with markdown unchanged', async () => {
      let service;
      ({ app, service } = await buildApp());
      const res = await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/document')
        .query({ path: 'docs/1.md' })
        .set(...AUTH)
        .expect(200);
      expect(res.body).toEqual(DOCUMENT);
      expect(service.getDocument).toHaveBeenCalledWith('rn', 'docs/1.md');
    });

    it('returns 400 when path is missing or empty', async () => {
      ({ app } = await buildApp());
      await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/document')
        .set(...AUTH)
        .expect(400);
      await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/document?path=')
        .set(...AUTH)
        .expect(400);
    });

    it('returns 400 for an unsafe path from the service', async () => {
      ({ app } = await buildApp({
        getDocument: vi.fn().mockRejectedValue(new BadRequestException('x')),
      }));
      await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/document')
        .query({ path: '../x.md' })
        .set(...AUTH)
        .expect(400);
    });

    it('rejects unknown query parameters', async () => {
      ({ app } = await buildApp());
      await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/document?path=a.md&host=evil.com')
        .set(...AUTH)
        .expect(400);
    });
  });

  describe('asset', () => {
    it('sends bytes with safe headers', async () => {
      ({ app } = await buildApp());
      const res = await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/asset')
        .query({ path: 'docs/a.png' })
        .set(...AUTH)
        .expect(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toBe('private, max-age=3600');
      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.body.toString()).toBe('PNG');
    });

    it('adds the sandboxed CSP to an SVG', async () => {
      ({ app } = await buildApp({
        getAsset: vi.fn().mockResolvedValue({
          bytes: Buffer.from('<svg/>'),
          contentType: 'image/svg+xml',
        }),
      }));
      const res = await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/asset')
        .query({ path: 'docs/a.svg' })
        .set(...AUTH)
        .expect(200);
      expect(res.headers['content-type']).toContain('image/svg+xml');
      expect(res.headers['content-security-policy']).toBe(
        SVG_CONTENT_SECURITY_POLICY,
      );
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it.each([
      [new BadRequestException('x'), 400],
      [new NotFoundException('x'), 404],
      [new BadGatewayException('x'), 502],
      [new ServiceUnavailableException('x'), 503],
    ])('maps %s to %i without asset headers', async (error, status) => {
      ({ app } = await buildApp({
        getAsset: vi.fn().mockRejectedValue(error),
      }));
      const res = await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/asset')
        .query({ path: 'docs/a.png' })
        .set(...AUTH)
        .expect(status);
      expect(res.headers['cache-control']).not.toBe('private, max-age=3600');
    });
  });

  describe('throttling', () => {
    it('answers 429 without an upstream call past the per-user limit', async () => {
      const release: (() => void)[] = [];
      const getDocument = vi.fn(
        () =>
          new Promise((resolve) => {
            release.push(() => resolve(DOCUMENT));
          }),
      );
      ({ app } = await buildApp({ getDocument }));
      const server = app.getHttpServer();
      const held = Array.from(
        { length: CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT },
        () =>
          request(server)
            .get('/api/v1/content-sources/rn/document?path=a.md')
            .set(...AUTH)
            .then((res) => res.status),
      );
      await vi.waitFor(() =>
        expect(getDocument).toHaveBeenCalledTimes(
          CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT,
        ),
      );

      await request(server)
        .get('/api/v1/content-sources/rn/document?path=a.md')
        .set(...AUTH)
        .expect(429);
      expect(getDocument).toHaveBeenCalledTimes(
        CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT,
      );

      release.forEach((done) => done());
      expect(await Promise.all(held)).toEqual(
        Array(CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT).fill(200),
      );
    });

    it('releases capacity after failures', async () => {
      const getDocument = vi
        .fn()
        .mockRejectedValue(new BadGatewayException('x'));
      ({ app } = await buildApp({ getDocument }));
      for (let i = 0; i < CONTENT_SOURCES_MAX_PRINCIPAL_IN_FLIGHT * 2; i++) {
        await request(app.getHttpServer())
          .get('/api/v1/content-sources/rn/document?path=a.md')
          .set(...AUTH)
          .expect(502);
      }
    });
  });
  describe('telemetry', () => {
    it('records a rejected credential as its own result category', async () => {
      const record = vi.spyOn(contentSourcesCallDuration, 'record');
      ({ app } = await buildApp({
        getDocument: vi
          .fn()
          .mockRejectedValue(new UpstreamCredentialsException()),
        listSource: vi.fn().mockRejectedValue(new BadGatewayException('x')),
      }));
      await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn/document?path=a.md')
        .set(...AUTH)
        .expect(502);
      await request(app.getHttpServer())
        .get('/api/v1/content-sources/rn')
        .set(...AUTH)
        .expect(502);

      const results = record.mock.calls.map(
        ([, attributes]) => attributes?.['dial.chat.content_sources.result'],
      );
      expect(results).toEqual([
        ContentSourceResult.UpstreamCredentials,
        ContentSourceResult.UpstreamError,
      ]);
      record.mockRestore();
    });
  });
});
