import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getApiErrorStatus } from '../../api-error/api-error';
import { checkScheduledTaskAuthSessionError } from '../check-scheduled-task-auth-session-error';

vi.mock('../../api-error/api-error', () => ({
  getApiErrorStatus: vi.fn(),
}));

const makeError = (status: number): unknown => ({ response: { status } });

const CONNECT = {
  clientId: 'dial-apps',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

describe('checkScheduledTaskAuthSessionError', () => {
  const getOfflineCredentials = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorStatus).mockImplementation(
      (error: unknown) =>
        (error as { response?: { status?: number } })?.response?.status ?? 0,
    );
  });

  it('attributes a 403 and returns the connect settings when the fresh check reports an available, disconnected client', async () => {
    getOfflineCredentials.mockResolvedValue({
      available: true,
      connected: false,
      connect: CONNECT,
    });

    const result = await checkScheduledTaskAuthSessionError(
      makeError(403),
      getOfflineCredentials,
    );

    expect(result.isAuthSessionError).toBe(true);
    expect(result.connect).toEqual(CONNECT);
    expect(getOfflineCredentials).toHaveBeenCalledOnce();
  });

  it('attributes a 403 but reports no connect settings when Core returns no connect object', async () => {
    getOfflineCredentials.mockResolvedValue({
      available: true,
      connected: false,
    });

    const result = await checkScheduledTaskAuthSessionError(
      makeError(403),
      getOfflineCredentials,
    );

    expect(result.isAuthSessionError).toBe(true);
    expect(result.connect).toBeUndefined();
  });

  it('returns the connect settings even while connected so the caller decides from one check', async () => {
    getOfflineCredentials.mockResolvedValue({
      available: true,
      connected: true,
      connect: CONNECT,
    });

    const result = await checkScheduledTaskAuthSessionError(
      makeError(403),
      getOfflineCredentials,
    );

    expect(result.isAuthSessionError).toBe(false);
    expect(result.connect).toEqual(CONNECT);
  });

  it('does not attribute a 403 when the user is still connected', async () => {
    getOfflineCredentials.mockResolvedValue({
      available: true,
      connected: true,
    });

    const result = await checkScheduledTaskAuthSessionError(
      makeError(403),
      getOfflineCredentials,
    );

    expect(result.isAuthSessionError).toBe(false);
  });

  it('does not attribute a 403 when the fresh check itself fails', async () => {
    getOfflineCredentials.mockRejectedValue(new Error('status down'));

    const result = await checkScheduledTaskAuthSessionError(
      makeError(403),
      getOfflineCredentials,
    );

    expect(result.isAuthSessionError).toBe(false);
    expect(result.connect).toBeUndefined();
  });

  it('does not attribute and issues no status request for a non-403 failure', async () => {
    const result = await checkScheduledTaskAuthSessionError(
      makeError(500),
      getOfflineCredentials,
    );

    expect(result.isAuthSessionError).toBe(false);
    expect(getOfflineCredentials).not.toHaveBeenCalled();
  });

  it('does not attribute and issues no status request for a successful submit error shape', async () => {
    const result = await checkScheduledTaskAuthSessionError(
      makeError(200),
      getOfflineCredentials,
    );

    expect(result.isAuthSessionError).toBe(false);
    expect(getOfflineCredentials).not.toHaveBeenCalled();
  });
});
