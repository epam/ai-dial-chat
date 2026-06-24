import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from '../theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  const mockConfigService = {
    get: vi.fn((key: string) => {
      const config = {
        THEMES_CONFIG_URL: 'https://themes.example.com',
        THEMES_SERVICE_TIMEOUT_MS: 5000,
      };
      return config[key as keyof typeof config];
    }),
  };

  const mockCacheManager = {
    get: vi.fn(),
    set: vi.fn(),
  };

  const mockFetchThatRejectsOnAbort = () =>
    vi.fn((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        });
      });
    });

  beforeEach(async () => {
    mockCacheManager.get.mockResolvedValue(undefined);
    mockCacheManager.set.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<ThemeService>(ThemeService);

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
      } as unknown as Response);

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
      } as unknown as Response);

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
      } as unknown as Response);

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

      global.fetch = mockFetchThatRejectsOnAbort() as unknown as typeof fetch;

      const promise = service.getThemes();
      const exceptionExpectation = expect(promise).rejects.toThrow(
        ServiceUnavailableException,
      );

      // Fast-forward time to trigger timeout
      await vi.advanceTimersByTimeAsync(5000);

      await exceptionExpectation;
      await expect(promise).rejects.toThrow('Theme service request timed out');

      vi.useRealTimers();
    });

    it('should handle invalid JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as unknown as Response);

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
      } as unknown as Response);

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
      } as unknown as Response);

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
      } as unknown as Response);

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

      global.fetch = mockFetchThatRejectsOnAbort() as unknown as typeof fetch;

      const promise = service.getThemeIcon('icon.svg');
      const exceptionExpectation = expect(promise).rejects.toThrow(
        ServiceUnavailableException,
      );

      await vi.advanceTimersByTimeAsync(5000);

      await exceptionExpectation;
      await expect(promise).rejects.toThrow('Theme service request timed out');

      vi.useRealTimers();
    });
  });
});
