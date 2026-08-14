import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { OfflineCredentialsService } from '../offline-credentials.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number, error: unknown = {}) =>
  ({ error, response: { status } as Response }) as never;

function makeService() {
  const dialClient = {
    client: {
      getOfflineCredentials: vi.fn(),
      offlineCredentialsSignIn: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new OfflineCredentialsService(dialClient);
  return { service, dialClient };
}

describe('OfflineCredentialsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getOfflineCredentialsStatus', () => {
    it('returns mapped status on success', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getOfflineCredentials).mockResolvedValue(
        okResponse({ available: true, connected: false }),
      );

      const result = await service.getOfflineCredentialsStatus('token');

      expect(result).toEqual({ available: true, connected: false });
      expect(dialClient.client.getOfflineCredentials).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
      });
    });

    it('throws NotFoundException on a 404 from Core', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getOfflineCredentials).mockResolvedValue(
        errResponse(404),
      );

      await expect(
        service.getOfflineCredentialsStatus('token'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('signIn', () => {
    it('signs in successfully when Core resolves true', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignIn).mockResolvedValue(
        okResponse(true),
      );

      await service.signIn('token', {
        code: 'auth-code',
        redirectUri: 'https://chat.example.com/auth/toolset-signin',
      });

      expect(dialClient.client.offlineCredentialsSignIn).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          code: 'auth-code',
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
        },
      });
    });

    it('maps a literal false Core response to a 502, never a success', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignIn).mockResolvedValue(
        okResponse(false),
      );

      await expect(
        service.signIn('token', {
          code: 'auth-code',
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('propagates a mapped exception for a non-OK Core response', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignIn).mockResolvedValue(
        errResponse(400, { error: { message: 'Invalid authorization code' } }),
      );

      const call = service.signIn('token', {
        code: 'auth-code',
        redirectUri: 'https://chat.example.com/auth/toolset-signin',
      });

      await expect(call).rejects.toThrow('Invalid authorization code');
    });

    it('never includes the code value in the debug log line', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignIn).mockResolvedValue(
        okResponse(true),
      );
      const debugSpy = vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).logger,
        'debug',
      );

      await service.signIn('token', {
        code: 'super-secret-authorization-code',
        redirectUri: 'https://chat.example.com/auth/toolset-signin',
      });

      const loggedText = debugSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(loggedText).not.toContain('super-secret-authorization-code');
    });
  });
});
