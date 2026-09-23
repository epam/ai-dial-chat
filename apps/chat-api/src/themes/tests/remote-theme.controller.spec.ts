import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteThemeController } from '../remote-theme.controller';
import { ThemeService } from '../theme.service';

// supertest is CJS; use require to avoid vite ESM interop issues
const request = require('supertest') as (
  app: Parameters<typeof import('supertest')>[0],
) => import('supertest').SuperTest<import('supertest').Test>;

const ALLOWED = 'https://themes.contoso.example.com';

const mockConfig = {
  themes: [{ id: 'light', displayName: 'Contoso Light', colors: {} }],
  images: {},
};

describe('RemoteThemeController (integration)', () => {
  let app: INestApplication;

  const mockThemeService = {
    getRemoteTheme: vi.fn(),
    getRemoteThemeIcon: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RemoteThemeController],
      providers: [{ provide: ThemeService, useValue: mockThemeService }],
    }).compile();

    app = module.createNestApplication();
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
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/themes/remote', () => {
    it('resolves under the versioned path and returns the configuration', async () => {
      mockThemeService.getRemoteTheme.mockResolvedValue(mockConfig);

      const response = await request(app.getHttpServer())
        .get('/api/v1/themes/remote')
        .query({ themeUrl: ALLOWED })
        .expect(200);

      expect(response.body).toEqual(mockConfig);
      expect(mockThemeService.getRemoteTheme).toHaveBeenCalledWith(ALLOWED);
    });

    it('sets a five-minute cache header', async () => {
      mockThemeService.getRemoteTheme.mockResolvedValue(mockConfig);

      const response = await request(app.getHttpServer())
        .get('/api/v1/themes/remote')
        .query({ themeUrl: ALLOWED })
        .expect(200);

      expect(response.headers['cache-control']).toBe('public, max-age=300');
    });

    it('rejects a plain-http url at the pipe, without reaching the service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/themes/remote')
        .query({ themeUrl: 'http://themes.contoso.example.com' })
        .expect(400);

      expect(mockThemeService.getRemoteTheme).not.toHaveBeenCalled();
    });

    it('rejects a missing themeUrl', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/themes/remote')
        .expect(400);

      expect(mockThemeService.getRemoteTheme).not.toHaveBeenCalled();
    });

    it('rejects an unknown query parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/themes/remote')
        .query({ themeUrl: ALLOWED, extra: 'nope' })
        .expect(400);
    });

    it('surfaces a disallowed origin as 400', async () => {
      mockThemeService.getRemoteTheme.mockRejectedValue(
        new BadRequestException('themeUrl origin is not allowed'),
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/themes/remote')
        .query({ themeUrl: 'https://evil.example.com' })
        .expect(400);

      expect(response.body.message).toBe('themeUrl origin is not allowed');
    });

    it('surfaces a missing configuration as 404', async () => {
      mockThemeService.getRemoteTheme.mockRejectedValue(
        new NotFoundException('Remote theme resource not found'),
      );

      await request(app.getHttpServer())
        .get('/api/v1/themes/remote')
        .query({ themeUrl: ALLOWED })
        .expect(404);
    });

    it('is not reachable at the unversioned path', async () => {
      await request(app.getHttpServer()).get('/api/themes/remote').expect(404);
    });
  });

  describe('GET /api/v1/themes/remote/icon', () => {
    it('returns svg content with an svg content type', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      mockThemeService.getRemoteThemeIcon.mockResolvedValue(svg);

      const response = await request(app.getHttpServer())
        .get('/api/v1/themes/remote/icon')
        .query({ themeUrl: ALLOWED, iconName: 'contoso-dark.svg' })
        .expect(200);

      expect(response.headers['content-type']).toContain('image/svg+xml');
      /* supertest buffers an svg body rather than exposing it as text. */
      expect(response.text ?? response.body?.toString()).toBe(svg);
      expect(mockThemeService.getRemoteThemeIcon).toHaveBeenCalledWith(
        ALLOWED,
        'contoso-dark.svg',
      );
    });

    it('derives the content type from the icon name', async () => {
      mockThemeService.getRemoteThemeIcon.mockResolvedValue(
        Buffer.from([1, 2, 3]),
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/themes/remote/icon')
        .query({ themeUrl: ALLOWED, iconName: 'logo.png' })
        .expect(200);

      expect(response.headers['content-type']).toContain('image/png');
    });

    /* Path traversal must die at the pipe, not at the themes host. */
    it('rejects a traversing icon name without reaching the service', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/themes/remote/icon')
        .query({ themeUrl: ALLOWED, iconName: '../../etc/passwd' })
        .expect(400);

      expect(mockThemeService.getRemoteThemeIcon).not.toHaveBeenCalled();
    });

    it('rejects a slash in the icon name', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/themes/remote/icon')
        .query({ themeUrl: ALLOWED, iconName: 'nested/logo.svg' })
        .expect(400);

      expect(mockThemeService.getRemoteThemeIcon).not.toHaveBeenCalled();
    });

    it('rejects a non-https themeUrl on the icon route too', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/themes/remote/icon')
        .query({ themeUrl: 'http://x.example.com', iconName: 'logo.svg' })
        .expect(400);

      expect(mockThemeService.getRemoteThemeIcon).not.toHaveBeenCalled();
    });
  });
});
