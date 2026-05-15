import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  get,
  post,
  put,
  setCsrfToken,
  ApiEndpoints,
  UnauthorizedError,
  onUnauthorized,
} from './base';

describe('API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    setCsrfToken(null);
  });

  describe('get', () => {
    it('should make GET request with valid response', async () => {
      const mockData = { themes: [] };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue(mockData),
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const result = await get(ApiEndpoints.THEMES);

      expect(global.fetch).toHaveBeenCalledWith(
        ApiEndpoints.THEMES,
        expect.objectContaining({
          method: 'GET',
        }),
      );
      expect(result).toEqual(mockData);
    });

    it('should handle text responses', async () => {
      const mockText = '<svg>...</svg>';
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('image/svg+xml'),
        },
        text: vi.fn().mockResolvedValue(mockText),
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const result = await get<string>(ApiEndpoints.THEME_ICON);

      expect(result).toBe(mockText);
    });

    it('should handle 204 No Content responses', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        headers: {
          get: vi.fn().mockReturnValue(''),
        },
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const result = await get('/api/test');

      expect(result).toBeUndefined();
    });

    it('should throw error for non-OK responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
      } as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await expect(get(ApiEndpoints.THEMES)).rejects.toThrow(
        'Request failed with status 404 for GET /api/themes',
      );
    });

    it('should throw error for network failures', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error'),
      );

      await expect(get(ApiEndpoints.THEMES)).rejects.toThrow('Network error');
    });

    it('should pass custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await get('/api/test', {
        headers: {
          'X-Custom-Header': 'test',
        },
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'test',
          }),
        }),
      );
    });
  });

  describe('post', () => {
    it('should make POST request with JSON body', async () => {
      const mockBody = { name: 'test' };
      const mockResponse = {
        ok: true,
        status: 201,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({ id: 1, ...mockBody }),
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const result = await post('/api/test', mockBody);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockBody),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual({ id: 1, ...mockBody });
    });

    it('should handle FormData body', async () => {
      const mockFormData = new FormData();
      mockFormData.append('file', new Blob(['test']));

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({ success: true }),
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await post('/api/upload', mockFormData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/upload',
        expect.objectContaining({
          method: 'POST',
          body: mockFormData,
          headers: expect.not.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('should handle POST without body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await post('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        }),
      );
    });
  });

  describe('credentials', () => {
    it('get passes credentials: include to fetch', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await get('/api/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('post passes credentials: include to fetch', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await post('/api/test', {});

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('put passes credentials: include to fetch', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await put('/api/test/1', {});

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('UnauthorizedError', () => {
    it('401 response throws UnauthorizedError with status 401 and url', async () => {
      const mockResponse = { ok: false, status: 401 } as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const err = await get('/api/protected').catch((e) => e);

      expect(err).toBeInstanceOf(UnauthorizedError);
      const unauthorizedErr = err as UnauthorizedError;
      expect(unauthorizedErr.status).toBe(401);
      expect(unauthorizedErr.url).toBe('/api/protected');
    });

    it('500 response throws a plain Error, not UnauthorizedError', async () => {
      const mockResponse = { ok: false, status: 500 } as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const err = await get('/api/protected').catch((e) => e);

      expect(err).toBeInstanceOf(Error);
      expect(err).not.toBeInstanceOf(UnauthorizedError);
    });

    it('onUnauthorized listener is invoked exactly once per 401 and not for non-401 errors', async () => {
      const listener = vi.fn();
      const cleanup = onUnauthorized(listener);

      const mock401 = { ok: false, status: 401 } as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mock401);
      await get('/api/protected').catch(() => undefined);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith('/api/protected');

      const mock500 = { ok: false, status: 500 } as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mock500);
      await get('/api/other').catch(() => undefined);

      expect(listener).toHaveBeenCalledTimes(1);

      cleanup();
    });

    it('cleanup callback unregisters the listener', async () => {
      const listener = vi.fn();
      const cleanup = onUnauthorized(listener);
      cleanup();

      const mock401 = { ok: false, status: 401 } as Response;
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mock401);
      await get('/api/protected').catch(() => undefined);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('CSRF token', () => {
    const okResponse = () =>
      ({
        ok: true,
        status: 200,
        headers: { get: vi.fn().mockReturnValue('application/json') },
        json: vi.fn().mockResolvedValue({}),
      }) as unknown as Response;

    it('responseHandler receives the Response object', async () => {
      const mockResponse = okResponse();
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );
      const handler = vi.fn();

      await get('/api/test', { responseHandler: handler });

      expect(handler).toHaveBeenCalledWith(mockResponse);
    });

    it('POST includes X-CSRF-Token when token is set', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        okResponse(),
      );
      setCsrfToken('test-csrf-token');

      await post('/api/test', {});

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token',
          }),
        }),
      );
    });

    it('GET does not include X-CSRF-Token even when token is set', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        okResponse(),
      );
      setCsrfToken('test-csrf-token');

      await get('/api/test');

      const [, fetchOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(
        (fetchOptions.headers as Record<string, string>)['X-CSRF-Token'],
      ).toBeUndefined();
    });

    it('POST does not include X-CSRF-Token when token is null', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        okResponse(),
      );

      await post('/api/test', {});

      const [, fetchOptions] = (global.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, RequestInit];
      expect(
        (fetchOptions.headers as Record<string, string>)['X-CSRF-Token'],
      ).toBeUndefined();
    });
  });

  describe('put', () => {
    it('should make PUT request with JSON body', async () => {
      const mockBody = { name: 'updated' };
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json'),
        },
        json: vi.fn().mockResolvedValue(mockBody),
      } as unknown as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      const result = await put('/api/test/1', mockBody);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/test/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(mockBody),
        }),
      );
      expect(result).toEqual(mockBody);
    });

    it('should throw error for failed PUT requests', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
      } as Response;

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResponse,
      );

      await expect(put('/api/test/1', {})).rejects.toThrow(
        'Request failed with status 500 for PUT /api/test/1',
      );
    });
  });
});
