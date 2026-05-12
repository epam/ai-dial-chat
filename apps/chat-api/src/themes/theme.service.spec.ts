import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let configService: ConfigService;

  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config = {
        THEMES_CONFIG_URL: 'https://themes.example.com',
        THEMES_SERVICE_TIMEOUT_MS: 5000,
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<ThemeService>(ThemeService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getThemes', () => {
    it('should successfully fetch and return theme configuration', async () => {
      const mockThemeConfig = {
        themes: [
          { id: 'light', name: 'Light Theme' },
          { id: 'dark', name: 'Dark Theme' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockThemeConfig),
      } as any);

      const result = await service.getThemes();

      expect(result).toEqual(mockThemeConfig);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://themes.example.com/config.json',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('should throw NotFoundException when theme configuration is not found (404)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any);

      await expect(service.getThemes()).rejects.toThrow(NotFoundException);
      await expect(service.getThemes()).rejects.toThrow(
        'Theme configuration not found',
      );
    });

    it('should throw BadGatewayException for non-404 HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      await expect(service.getThemes()).rejects.toThrow(BadGatewayException);
      await expect(service.getThemes()).rejects.toThrow(
        'Failed to fetch theme configuration',
      );
    });

    it('should throw ServiceUnavailableException when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.getThemes()).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(service.getThemes()).rejects.toThrow(
        'Theme service is currently unavailable',
      );
    });

    it('should throw ServiceUnavailableException on timeout', async () => {
      vi.useFakeTimers();

      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true } as any), 10000);
          }),
      );

      const promise = service.getThemes();

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow(ServiceUnavailableException);
      await expect(promise).rejects.toThrow('Theme service request timed out');

      vi.useRealTimers();
    });

    it('should handle invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any);

      await expect(service.getThemes()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getThemeIcon', () => {
    it('should successfully fetch and return theme icon', async () => {
      const mockSvgContent = '<svg>...</svg>';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockSvgContent),
      } as any);

      const result = await service.getThemeIcon('icon-light.svg');

      expect(result).toBe(mockSvgContent);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://themes.example.com/icon-light.svg',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('should throw NotFoundException when icon is not found (404)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any);

      await expect(service.getThemeIcon('missing-icon.svg')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getThemeIcon('missing-icon.svg')).rejects.toThrow(
        "Theme icon 'missing-icon.svg' not found",
      );
    });

    it('should throw BadGatewayException for non-404 HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      await expect(service.getThemeIcon('icon.svg')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('should throw ServiceUnavailableException when fetch fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(service.getThemeIcon('icon.svg')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException on timeout', async () => {
      vi.useFakeTimers();

      global.fetch = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ ok: true } as any), 10000);
          }),
      );

      const promise = service.getThemeIcon('icon.svg');

      vi.advanceTimersByTime(5000);

      await expect(promise).rejects.toThrow(ServiceUnavailableException);
      await expect(promise).rejects.toThrow('Theme service request timed out');

      vi.useRealTimers();
    });
  });
});
