import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiEndpoints,
  CsrfRefreshStatus,
  UnauthorizedError,
  get,
  getCsrfToken,
  hasRequiredProperties,
  isInvalidCsrfErrorBody,
  isValidResponse,
  onUnauthorized,
  post,
  put,
  refreshCsrfToken,
  setCsrfToken,
} from '../base';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = (overrides: Partial<Response> = {}) => {
  const response: Partial<Response> = {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn().mockResolvedValue({ data: 'ok' }),
    text: vi.fn().mockResolvedValue(''),
    ...overrides,
  };
  global.fetch = vi.fn().mockResolvedValue(response as Response);
  return response as Response;
};

afterEach(() => {
  setCsrfToken(null);
});

// ---------------------------------------------------------------------------
// UnauthorizedError
// ---------------------------------------------------------------------------

describe('UnauthorizedError', () => {
  it('has status 401', () => {
    const err = new UnauthorizedError('/api/test');
    expect(err.status).toBe(401);
  });

  it('includes the url in the message', () => {
    const err = new UnauthorizedError('/api/test');
    expect(err.message).toContain('/api/test');
  });

  it('has correct name', () => {
    const err = new UnauthorizedError('/api/test');
    expect(err.name).toBe('UnauthorizedError');
  });

  it('is an instance of Error', () => {
    expect(new UnauthorizedError('/api/test')).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// onUnauthorized
// ---------------------------------------------------------------------------

describe('onUnauthorized', () => {
  it('calls registered listener when a 401 occurs', async () => {
    setCsrfToken('stale-csrf-token');
    const listener = vi.fn();
    const unregister = onUnauthorized(listener);

    mockFetch({ ok: false, status: 401, text: vi.fn().mockResolvedValue('') });

    await expect(get('/api/test')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(listener).toHaveBeenCalledWith('/api/test');
    expect(getCsrfToken()).toBeNull();

    unregister();
  });

  it('does not call listener after unregistering', async () => {
    const listener = vi.fn();
    const unregister = onUnauthorized(listener);
    unregister();

    mockFetch({ ok: false, status: 401, text: vi.fn().mockResolvedValue('') });

    await expect(get('/api/test')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(listener).not.toHaveBeenCalled();
  });

  it('refreshes CSRF token and retries once on invalid CSRF responses', async () => {
    setCsrfToken('stale-csrf-token');
    const listener = vi.fn();
    const unregister = onUnauthorized(listener);
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Invalid CSRF token',
            error: 'Forbidden',
            statusCode: 403,
          }),
        ),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-csrf-token': 'fresh-csrf-token' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: 'ok' }),
      } as unknown as Response);
    global.fetch = fetchSpy;

    await expect(post('/api/test', {})).resolves.toEqual({ data: 'ok' });
    expect(listener).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('fresh-csrf-token');
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toMatchObject({
      'X-CSRF-Token': 'stale-csrf-token',
    });
    expect(fetchSpy.mock.calls[1]?.[0]).toBe(ApiEndpoints.AUTH_ME);
    expect(fetchSpy.mock.calls[2]?.[1]?.headers).toMatchObject({
      'X-CSRF-Token': 'fresh-csrf-token',
    });

    unregister();
  });

  it('notifies unauthorized when CSRF refresh gets a 401 response', async () => {
    setCsrfToken('stale-csrf-token');
    const listener = vi.fn();
    const unregister = onUnauthorized(listener);
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Invalid CSRF token',
            error: 'Forbidden',
            statusCode: 403,
          }),
        ),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers(),
      } as Response);
    global.fetch = fetchSpy;

    await expect(post('/api/test', {})).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(listener).toHaveBeenCalledWith(ApiEndpoints.AUTH_ME);
    expect(getCsrfToken()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    unregister();
  });

  it('notifies unauthorized when CSRF refresh fails during invalid CSRF recovery', async () => {
    setCsrfToken('stale-csrf-token');
    const listener = vi.fn();
    const unregister = onUnauthorized(listener);
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            code: 'CSRF_INVALID',
            message: 'Invalid CSRF token',
            error: 'Forbidden',
            statusCode: 403,
          }),
        ),
      } as unknown as Response)
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    global.fetch = fetchSpy;

    await expect(post('/api/test', {})).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(listener).toHaveBeenCalledWith('/api/test');
    expect(getCsrfToken()).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    unregister();
  });

  it('shares one in-flight CSRF refresh request', async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'x-csrf-token': 'fresh-csrf-token' },
      }),
    );
    global.fetch = fetchSpy;

    const [first, second] = await Promise.all([
      refreshCsrfToken(),
      refreshCsrfToken(),
    ]);

    expect(first).toEqual({
      status: CsrfRefreshStatus.Ok,
      token: 'fresh-csrf-token',
    });
    expect(second).toEqual({
      status: CsrfRefreshStatus.Ok,
      token: 'fresh-csrf-token',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(getCsrfToken()).toBe('fresh-csrf-token');
  });

  it('keeps the current CSRF token when refresh network request fails', async () => {
    setCsrfToken('stale-csrf-token');
    global.fetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError('Network error'));

    await expect(refreshCsrfToken()).resolves.toEqual({
      status: CsrfRefreshStatus.Failed,
    });
    expect(getCsrfToken()).toBe('stale-csrf-token');
  });

  it('keeps the current CSRF token while refresh is in flight', async () => {
    setCsrfToken('stale-csrf-token');
    let resolveRefresh: (response: Response) => void = () => undefined;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    global.fetch = vi.fn<typeof fetch>().mockReturnValue(refreshResponse);

    const refreshPromise = refreshCsrfToken();

    expect(getCsrfToken()).toBe('stale-csrf-token');

    resolveRefresh(
      new Response(null, {
        status: 200,
        headers: { 'x-csrf-token': 'fresh-csrf-token' },
      }),
    );

    await expect(refreshPromise).resolves.toEqual({
      status: CsrfRefreshStatus.Ok,
      token: 'fresh-csrf-token',
    });
    expect(getCsrfToken()).toBe('fresh-csrf-token');
  });

  it('does not clear a newer CSRF token when a stale invalid CSRF response arrives', async () => {
    setCsrfToken('stale-csrf-token');
    const listener = vi.fn();
    const unregister = onUnauthorized(listener);
    global.fetch = vi.fn<typeof fetch>().mockImplementation(async () => {
      setCsrfToken('fresh-csrf-token');
      return {
        ok: false,
        status: 403,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: vi.fn().mockResolvedValue(
          JSON.stringify({
            message: 'Invalid CSRF token',
            error: 'Forbidden',
            statusCode: 403,
          }),
        ),
      } as unknown as Response;
    });

    await expect(post('/api/test', {})).rejects.toThrow('Invalid CSRF token');
    expect(listener).not.toHaveBeenCalled();
    expect(getCsrfToken()).toBe('fresh-csrf-token');

    unregister();
  });
});

// ---------------------------------------------------------------------------
// CSRF errors
// ---------------------------------------------------------------------------

describe('isInvalidCsrfErrorBody', () => {
  it('detects invalid CSRF by stable error code', () => {
    expect(
      isInvalidCsrfErrorBody(
        JSON.stringify({
          code: 'CSRF_INVALID',
          error: 'Forbidden',
          message: 'Different message',
          statusCode: 403,
        }),
      ),
    ).toBe(true);
  });

  it('keeps the legacy backend message fallback', () => {
    expect(
      isInvalidCsrfErrorBody(
        JSON.stringify({
          error: 'Forbidden',
          message: 'Invalid CSRF token',
          statusCode: 403,
        }),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidResponse
// ---------------------------------------------------------------------------

describe('isValidResponse', () => {
  it('returns true when validator passes', () => {
    const isString = (d: unknown): d is string => typeof d === 'string';
    expect(isValidResponse('hello', isString)).toBe(true);
  });

  it('returns false when validator fails', () => {
    const isString = (d: unknown): d is string => typeof d === 'string';
    expect(isValidResponse(42, isString)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasRequiredProperties
// ---------------------------------------------------------------------------

describe('hasRequiredProperties', () => {
  it('returns true when all properties are present', () => {
    expect(hasRequiredProperties({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
  });

  it('returns false when a property is missing', () => {
    expect(hasRequiredProperties({ a: 1 }, ['a', 'b'])).toBe(false);
  });

  it('returns false for null', () => {
    expect(hasRequiredProperties(null, ['a'])).toBe(false);
  });

  it('returns false for a primitive', () => {
    expect(hasRequiredProperties(42, ['a'])).toBe(false);
  });

  it('returns true for empty required list', () => {
    expect(hasRequiredProperties({}, [])).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HTTP methods – request dispatch and parseResponse
// ---------------------------------------------------------------------------

describe('get', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls fetch with GET method and correct url', async () => {
    mockFetch();
    await get('/api/test');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns parsed JSON response', async () => {
    mockFetch({ json: vi.fn().mockResolvedValue({ value: 42 }) });
    const result = await get<{ value: number }>('/api/test');
    expect(result).toEqual({ value: 42 });
  });

  it('throws for non-ok response', async () => {
    mockFetch({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('err'),
    });
    await expect(get('/api/test')).rejects.toThrow(
      'Request failed with status 500',
    );
  });

  it('returns text when content-type is not JSON', async () => {
    mockFetch({
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: vi.fn().mockResolvedValue('plain text'),
    });
    const result = await get<string>('/api/test');
    expect(result).toBe('plain text');
  });

  it('returns undefined for 204 No Content', async () => {
    mockFetch({
      status: 204,
      headers: new Headers({}),
    });
    const result = await get('/api/test');
    expect(result).toBeUndefined();
  });
});

describe('post', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls fetch with POST method', async () => {
    mockFetch();
    await post('/api/test', { key: 'value' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('serializes body as JSON', async () => {
    mockFetch();
    await post('/api/test', { key: 'value' });
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).toBe(JSON.stringify({ key: 'value' }));
  });

  it('sends FormData without Content-Type override', async () => {
    mockFetch();
    const formData = new FormData();
    formData.append('field', 'val');
    await post('/api/test', formData);
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBe(formData);
  });
});

describe('put', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls fetch with PUT method', async () => {
    mockFetch();
    await put('/api/test', { key: 'value' });
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

// ---------------------------------------------------------------------------
// CSRF token
// ---------------------------------------------------------------------------

describe('setCsrfToken', () => {
  afterEach(() => {
    setCsrfToken(null);
    vi.restoreAllMocks();
  });

  it('includes X-CSRF-Token header in non-GET requests when set', async () => {
    setCsrfToken('my-csrf-token');
    mockFetch();
    await post('/api/test', {});
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['X-CSRF-Token']).toBe('my-csrf-token');
  });

  it('does not include X-CSRF-Token in GET requests', async () => {
    setCsrfToken('my-csrf-token');
    mockFetch();
    await get('/api/test');
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['X-CSRF-Token']).toBeUndefined();
  });

  it('does not include X-CSRF-Token when token is null', async () => {
    setCsrfToken(null);
    mockFetch();
    await post('/api/test', {});
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers['X-CSRF-Token']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// parseResponse – error paths
// ---------------------------------------------------------------------------

describe('parseResponse – malformed JSON', () => {
  afterEach(() => vi.restoreAllMocks());

  it('throws a descriptive error for malformed JSON', async () => {
    mockFetch({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
    });
    await expect(get('/api/test')).rejects.toThrow(
      'Failed to parse JSON response: malformed JSON',
    );
  });

  it('rethrows non-SyntaxError from JSON parsing', async () => {
    mockFetch({
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockRejectedValue(new TypeError('type error')),
    });
    await expect(get('/api/test')).rejects.toThrow('type error');
  });
});

// ---------------------------------------------------------------------------
// ApiEndpoints enum sanity check
// ---------------------------------------------------------------------------

describe('ApiEndpoints', () => {
  it('exposes expected endpoint values', () => {
    expect(ApiEndpoints.THEMES).toBe('/api/themes');
    expect(ApiEndpoints.CONVERSATIONS).toBe('/api/v1/conversations');
    expect(ApiEndpoints.MODELS).toBe('/api/v1/models');
    expect(ApiEndpoints.AUTH_ME).toBe('/api/v1/auth/me');
    expect(ApiEndpoints.AUTH_LOGOUT).toBe('/api/v1/auth/logout');
  });
});
