import { getApiErrorStatus } from '@epam/ai-dial-chat-hooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOfflineCredentials } from '../../server-api/offline-credentials';
import { checkScheduledTaskAuthSessionError } from '../scheduled-task-auth-error';

vi.mock('@epam/ai-dial-chat-hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@epam/ai-dial-chat-hooks')>()),
  getApiErrorStatus: vi.fn(),
}));

vi.mock('../../server-api/offline-credentials', () => ({
  getOfflineCredentials: vi.fn(),
}));

const mockGetOfflineCredentials = vi.mocked(getOfflineCredentials);

const makeError = (status: number): unknown => ({ response: { status } });

const CONNECT = {
  clientId: 'dial-apps',
  authorizationEndpoint: 'https://identity.example.com/authorize',
  scopes: ['openid', 'offline_access'],
};

describe('checkScheduledTaskAuthSessionError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getApiErrorStatus).mockImplementation(
      (error: unknown) =>
        (error as { response?: { status?: number } })?.response?.status ?? 0,
    );
  });

  it('attributes a 403 and returns the connect settings when the fresh check reports an available, disconnected client', async () => {
    mockGetOfflineCredentials.mockResolvedValue({
      available: true,
      connected: false,
      connect: CONNECT,
    });

    const result = await checkScheduledTaskAuthSessionError(makeError(403));

    expect(result.isAuthSessionError).toBe(true);
    expect(result.connect).toEqual(CONNECT);
    expect(mockGetOfflineCredentials).toHaveBeenCalledOnce();
  });

  it('attributes a 403 but reports no connect settings when Core returns no connect object', async () => {
    mockGetOfflineCredentials.mockResolvedValue({
      available: true,
      connected: false,
    });

    const result = await checkScheduledTaskAuthSessionError(makeError(403));

    expect(result.isAuthSessionError).toBe(true);
    expect(result.connect).toBeUndefined();
  });

  it('returns the connect settings even while connected so the caller decides from one check', async () => {
    mockGetOfflineCredentials.mockResolvedValue({
      available: true,
      connected: true,
      connect: CONNECT,
    });

    const result = await checkScheduledTaskAuthSessionError(makeError(403));

    expect(result.isAuthSessionError).toBe(false);
    expect(result.connect).toEqual(CONNECT);
  });

  it('does not attribute a 403 when the user is still connected', async () => {
    mockGetOfflineCredentials.mockResolvedValue({
      available: true,
      connected: true,
    });

    const result = await checkScheduledTaskAuthSessionError(makeError(403));

    expect(result.isAuthSessionError).toBe(false);
  });

  it('does not attribute a 403 when the fresh check itself fails', async () => {
    mockGetOfflineCredentials.mockRejectedValue(new Error('status down'));

    const result = await checkScheduledTaskAuthSessionError(makeError(403));

    expect(result.isAuthSessionError).toBe(false);
    expect(result.connect).toBeUndefined();
  });

  it('does not attribute and issues no status request for a non-403 failure', async () => {
    const result = await checkScheduledTaskAuthSessionError(makeError(500));

    expect(result.isAuthSessionError).toBe(false);
    expect(mockGetOfflineCredentials).not.toHaveBeenCalled();
  });

  it('does not attribute and issues no status request for a successful submit error shape', async () => {
    const result = await checkScheduledTaskAuthSessionError(makeError(200));

    expect(result.isAuthSessionError).toBe(false);
    expect(mockGetOfflineCredentials).not.toHaveBeenCalled();
  });
});
