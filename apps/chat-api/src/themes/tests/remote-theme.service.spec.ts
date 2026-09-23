import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadGatewayException,
  BadRequestException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from '../theme.service';

const ALLOWED = 'https://themes.contoso.example.com';
const SECOND_ALLOWED = 'https://themes.fabrikam.example.com:8443';

const okJson = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers(),
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: () => {
            if (sent) return Promise.resolve({ done: true, value: undefined });
            sent = true;
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode(JSON.stringify(body)),
            });
          },
          cancel: () => Promise.resolve(),
        };
      },
    },
  }) as unknown as Response;

const okBytes = (bytes: Uint8Array, contentLength?: number) =>
  ({
    ok: true,
    status: 200,
    headers: new Headers(
      contentLength == null ? {} : { 'content-length': String(contentLength) },
    ),
    body: {
      getReader: () => {
        let sent = false;
        return {
          read: () => {
            if (sent) return Promise.resolve({ done: true, value: undefined });
            sent = true;
            return Promise.resolve({ done: false, value: bytes });
          },
          cancel: () => Promise.resolve(),
        };
      },
    },
  }) as unknown as Response;

const validConfig = {
  themes: [
    {
      id: 'light',
      displayName: 'Contoso Light',
      colors: { 'bg-base': '#fff' },
    },
    { id: 'dark', displayName: 'Contoso Dark', colors: { 'bg-base': '#000' } },
  ],
  images: { 'chat-logo-dark': 'contoso-dark.svg' },
};

describe('ThemeService — remote themes', () => {
  let service: ThemeService;
  let warn: ReturnType<typeof vi.spyOn>;

  const env: Record<string, unknown> = {};

  const mockCacheManager = { get: vi.fn(), set: vi.fn() };

  const warnedWith = (needle: string) =>
    (warn.mock.calls as unknown[][]).some((call) =>
      String(call[0]).includes(needle),
    );

  const createService = async (
    overrides: Record<string, unknown> = {},
  ): Promise<ThemeService> => {
    Object.keys(env).forEach((key) => delete env[key]);
    Object.assign(
      env,
      {
        THEMES_CONFIG_URL: 'https://themes.example.com',
        THEMES_SERVICE_TIMEOUT_MS: 5000,
        THEMES_ALLOWED_ORIGINS: `${ALLOWED}, ${SECOND_ALLOWED}`,
      },
      overrides,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ThemeService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    return module.get<ThemeService>(ThemeService);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheManager.get.mockResolvedValue(undefined);
    mockCacheManager.set.mockResolvedValue(undefined);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => void 0);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => void 0);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => void 0);
    service = await createService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('origin allowlist', () => {
    it('admits every https origin in the list', async () => {
      global.fetch = vi.fn().mockResolvedValue(okJson(validConfig));

      await service.getRemoteTheme(ALLOWED);
      await service.getRemoteTheme(SECOND_ALLOWED);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('drops a non-https entry with a warning and boots', async () => {
      warn.mockClear();
      const withBadEntry = await createService({
        THEMES_ALLOWED_ORIGINS: `http://insecure.example.com, ${ALLOWED}`,
      });
      global.fetch = vi.fn();

      expect(warnedWith('http://insecure.example.com')).toBe(true);
      await expect(
        withBadEntry.getRemoteTheme('https://insecure.example.com'),
      ).rejects.toThrow(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('drops an unparseable entry with a warning', async () => {
      warn.mockClear();
      await createService({ THEMES_ALLOWED_ORIGINS: 'not a url' });

      expect(warnedWith('not a url')).toBe(true);
    });

    it('rejects an origin that is not allow-listed before opening a socket', async () => {
      global.fetch = vi.fn();

      await expect(
        service.getRemoteTheme('https://evil.example.com'),
      ).rejects.toThrow(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    /* Exact origin equality — a suffix match would admit this. */
    it('rejects a look-alike host that merely starts with an allowed one', async () => {
      global.fetch = vi.fn();

      await expect(
        service.getRemoteTheme(
          'https://themes.contoso.example.com.attacker.test',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects an internal address without disclosing reachability', async () => {
      global.fetch = vi.fn();

      await expect(
        service.getRemoteTheme('https://169.254.169.254/latest/meta-data'),
      ).rejects.toThrow('themeUrl origin is not allowed');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a non-https url', async () => {
      global.fetch = vi.fn();

      await expect(
        service.getRemoteTheme('http://themes.contoso.example.com'),
      ).rejects.toThrow('themeUrl must use https');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects a malformed url', async () => {
      global.fetch = vi.fn();

      await expect(service.getRemoteTheme('not a url')).rejects.toThrow(
        'themeUrl is not a valid URL',
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getRemoteTheme', () => {
    it('requests config.json at the supplied path and returns the configuration', async () => {
      global.fetch = vi.fn().mockResolvedValue(okJson(validConfig));

      const result = await service.getRemoteTheme(`${ALLOWED}/brand`);

      expect(global.fetch).toHaveBeenCalledWith(
        `${ALLOWED}/brand/config.json`,
        expect.objectContaining({ redirect: 'manual' }),
      );
      expect(result.themes).toHaveLength(2);
    });

    it('discards any query string and fragment on the supplied url', async () => {
      global.fetch = vi.fn().mockResolvedValue(okJson(validConfig));

      await service.getRemoteTheme(`${ALLOWED}/brand?x=1#y`);

      expect(global.fetch).toHaveBeenCalledWith(
        `${ALLOWED}/brand/config.json`,
        expect.anything(),
      );
    });

    it('refuses to follow a redirect', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 302,
        statusText: 'Found',
        headers: new Headers({ location: 'http://10.0.0.1/' }),
      } as unknown as Response);

      await expect(service.getRemoteTheme(ALLOWED)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('maps a 404 to NotFoundException', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
      } as unknown as Response);

      await expect(service.getRemoteTheme(ALLOWED)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('maps a timeout to ServiceUnavailableException', async () => {
      global.fetch = vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          });
        });
      }) as unknown as typeof fetch;

      const quick = await createService({ THEMES_SERVICE_TIMEOUT_MS: 1 });

      await expect(quick.getRemoteTheme(ALLOWED)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('refuses a body that declares more than the size cap', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(okBytes(new Uint8Array(8), 300 * 1024));

      await expect(service.getRemoteTheme(ALLOWED)).rejects.toThrow(
        'Remote theme response is too large',
      );
    });

    it('refuses a body that exceeds the cap while streaming', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(okBytes(new Uint8Array(300 * 1024)));

      await expect(service.getRemoteTheme(ALLOWED)).rejects.toThrow(
        'Remote theme response is too large',
      );
    });

    it('refuses a body that is not JSON', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(okBytes(new TextEncoder().encode('<html>')));

      await expect(service.getRemoteTheme(ALLOWED)).rejects.toThrow(
        'Remote theme configuration is malformed',
      );
    });

    it('refuses a configuration with no themes', async () => {
      global.fetch = vi.fn().mockResolvedValue(okJson({ themes: [] }));

      await expect(service.getRemoteTheme(ALLOWED)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('refuses a theme without an id', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(okJson({ themes: [{ colors: {} }] }));

      await expect(service.getRemoteTheme(ALLOWED)).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('drops a colour key that is unsafe as a custom property name', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        okJson({
          themes: [
            {
              id: 'light',
              colors: { 'bg-base': '#000', 'x;}body{display:none': '#fff' },
            },
          ],
          images: {},
        }),
      );

      const result = await service.getRemoteTheme(ALLOWED);

      expect(result.themes[0].colors).toEqual({ 'bg-base': '#000' });
    });

    it('drops a non-string colour value', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        okJson({
          themes: [{ id: 'light', colors: { 'bg-base': '#000', bad: 42 } }],
          images: {},
        }),
      );

      const result = await service.getRemoteTheme(ALLOWED);

      expect(result.themes[0].colors).toEqual({ 'bg-base': '#000' });
    });

    it('serves a repeat request from the cache without an outbound call', async () => {
      mockCacheManager.get.mockResolvedValue(validConfig);
      global.fetch = vi.fn();

      const result = await service.getRemoteTheme(ALLOWED);

      expect(result).toEqual(validConfig);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('keys the cache by origin and path, so two paths do not collide', async () => {
      global.fetch = vi.fn().mockResolvedValue(okJson(validConfig));

      await service.getRemoteTheme(`${ALLOWED}/one`);
      await service.getRemoteTheme(`${ALLOWED}/two`);

      const [firstKey] = mockCacheManager.set.mock.calls[0];
      const [secondKey] = mockCacheManager.set.mock.calls[1];
      expect(firstKey).not.toEqual(secondKey);
    });
  });

  describe('getRemoteThemeIcon', () => {
    it('returns svg markup as text', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
      global.fetch = vi
        .fn()
        .mockResolvedValue(okBytes(new TextEncoder().encode(svg)));

      const result = await service.getRemoteThemeIcon(
        ALLOWED,
        'contoso-dark.svg',
      );

      expect(result).toBe(svg);
      expect(global.fetch).toHaveBeenCalledWith(
        `${ALLOWED}/contoso-dark.svg`,
        expect.objectContaining({ redirect: 'manual' }),
      );
    });

    it('returns a non-svg icon as a buffer', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(okBytes(new Uint8Array([1, 2, 3])));

      const result = await service.getRemoteThemeIcon(ALLOWED, 'logo.png');

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('rejects a non-allow-listed origin before opening a socket', async () => {
      global.fetch = vi.fn();

      await expect(
        service.getRemoteThemeIcon('https://evil.example.com', 'logo.svg'),
      ).rejects.toThrow(BadRequestException);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('maps a missing icon to NotFoundException', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers(),
      } as unknown as Response);

      await expect(
        service.getRemoteThemeIcon(ALLOWED, 'missing.svg'),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses an oversized icon', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(okBytes(new Uint8Array(8), 3 * 1024 * 1024));

      await expect(
        service.getRemoteThemeIcon(ALLOWED, 'huge.png'),
      ).rejects.toThrow('Remote theme response is too large');
    });

    it('serves a cached icon without an outbound call', async () => {
      mockCacheManager.get.mockResolvedValue('<svg />');
      global.fetch = vi.fn();

      const result = await service.getRemoteThemeIcon(ALLOWED, 'logo.svg');

      expect(result).toBe('<svg />');
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
