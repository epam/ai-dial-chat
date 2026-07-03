import { afterEach, describe, expect, it, vi } from 'vitest';
import { logout } from '../auth.api';
import { getCsrfToken, setCsrfToken } from '../base';

describe('auth.api', () => {
  afterEach(() => {
    setCsrfToken(null);
    vi.restoreAllMocks();
  });

  it('clears CSRF token after logout request', async () => {
    setCsrfToken('csrf-token');
    global.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
      }),
    );

    await logout();

    expect(getCsrfToken()).toBeNull();
  });

  it('clears CSRF token when logout request fails', async () => {
    setCsrfToken('csrf-token');
    global.fetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network error'));

    await expect(logout()).rejects.toThrow('network error');
    expect(getCsrfToken()).toBeNull();
  });
});
