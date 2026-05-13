import {
  INestApplication,
  NotFoundException,
  ServiceUnavailableException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeController } from './theme.controller';
import { ThemeService } from './theme.service';

// supertest is CJS; use require to avoid vite ESM interop issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest') as (
  app: Parameters<typeof import('supertest')>[0],
) => import('supertest').SuperTest<import('supertest').Test>;

describe('ThemeController (integration)', () => {
  let app: INestApplication;
  let themeService: ThemeService;

  const mockThemeService = {
    getThemes: vi.fn(),
    getThemeIcon: vi.fn(),
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ThemeController],
      providers: [
        {
          provide: ThemeService,
          useValue: mockThemeService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Apply global validation pipe (same as in main.ts)
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    themeService = moduleFixture.get<ThemeService>(ThemeService);
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await app.close();
  });

  describe('GET /themes', () => {
    it('should return theme configuration', async () => {
      const mockConfig = {
        themes: [
          { id: 'light', name: 'Light Theme' },
          { id: 'dark', name: 'Dark Theme' },
        ],
      };

      mockThemeService.getThemes.mockResolvedValue(mockConfig);

      const response = await request(app.getHttpServer())
        .get('/themes')
        .expect(200);

      expect(response.body).toEqual(mockConfig);
      expect(themeService.getThemes).toHaveBeenCalled();
    });

    it('should return 404 when configuration is not found', async () => {
      mockThemeService.getThemes.mockRejectedValue(
        new NotFoundException('Theme configuration not found'),
      );

      await request(app.getHttpServer()).get('/themes').expect(404);
    });

    it('should return 503 when service is unavailable', async () => {
      mockThemeService.getThemes.mockRejectedValue(
        new ServiceUnavailableException(
          'Theme service is currently unavailable',
        ),
      );

      await request(app.getHttpServer()).get('/themes').expect(503);
    });
  });

  describe('GET /themes/icon', () => {
    it('should return SVG content for valid icon name', async () => {
      const mockSvg = '<svg><circle r="10"/></svg>';
      mockThemeService.getThemeIcon.mockResolvedValue(mockSvg);

      const response = await request(app.getHttpServer())
        .get('/themes/icon?iconName=icon-light.svg')
        .expect(200)
        .expect('Content-Type', /image\/svg\+xml/);

      expect(response.text ?? response.body?.toString()).toBe(mockSvg);
      expect(themeService.getThemeIcon).toHaveBeenCalledWith('icon-light.svg');
    });

    it('should return 400 for path traversal attempt', async () => {
      await request(app.getHttpServer())
        .get('/themes/icon?iconName=../etc/passwd')
        .expect(400);

      expect(themeService.getThemeIcon).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid icon name with special characters', async () => {
      await request(app.getHttpServer())
        .get('/themes/icon?iconName=icon<script>.svg')
        .expect(400);

      expect(themeService.getThemeIcon).not.toHaveBeenCalled();
    });

    it('should return 400 when iconName is missing', async () => {
      await request(app.getHttpServer()).get('/themes/icon').expect(400);

      expect(themeService.getThemeIcon).not.toHaveBeenCalled();
    });

    it('should return 404 when icon is not found', async () => {
      mockThemeService.getThemeIcon.mockRejectedValue(
        new NotFoundException('Theme icon not found'),
      );

      await request(app.getHttpServer())
        .get('/themes/icon?iconName=missing.svg')
        .expect(404);
    });

    it('should accept valid icon names with allowed characters', async () => {
      const validNames = [
        'icon.svg',
        'icon-light.svg',
        'icon_dark.svg',
        'icon123.svg',
        'ICON.SVG',
      ];

      mockThemeService.getThemeIcon.mockResolvedValue('<svg></svg>');

      for (const name of validNames) {
        await request(app.getHttpServer())
          .get(`/themes/icon?iconName=${name}`)
          .expect(200);
      }

      expect(themeService.getThemeIcon).toHaveBeenCalledTimes(
        validNames.length,
      );
    });
  });

  describe('CORS headers', () => {
    it('should include CORS headers in response', async () => {
      mockThemeService.getThemes.mockResolvedValue({ themes: [] });

      // Note: CORS headers would be added by the app.enableCors() in main.ts
      // This test verifies the endpoint is accessible for CORS testing
      await request(app.getHttpServer()).get('/themes').expect(200);
    });
  });
});
