import {
  BadGatewayException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { SchedulerServiceConsentStatus } from '../../external-services/types/scheduler-service-consent-status.enum';
import {
  OfflineCredentialsService,
  SCHEDULER_CONSENT_READ_TIMEOUT_MS,
} from '../offline-credentials.service';

const okResponse = (data: unknown) =>
  ({ data, response: { status: 200 } as Response }) as never;

const errResponse = (status: number, error: unknown = {}) =>
  ({ error, response: { status } as Response }) as never;

function makeService() {
  const dialClient = {
    client: {
      getOfflineCredentials: vi.fn(),
      offlineCredentialsSignIn: vi.fn(),
      offlineCredentialsSignOut: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const schedulerConsent = {
    getSchedulerServiceConsent: vi
      .fn()
      .mockResolvedValue(SchedulerServiceConsentStatus.SignedIn),
  };
  const service = new OfflineCredentialsService(
    dialClient,
    schedulerConsent as never,
  );
  return { service, dialClient, schedulerConsent };
}

describe('OfflineCredentialsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getOfflineCredentialsStatus', () => {
    it('returns mapped status on success', async () => {
      const { service, dialClient, schedulerConsent } = makeService();
      vi.mocked(dialClient.client.getOfflineCredentials).mockResolvedValue(
        okResponse({ available: true, connected: false }),
      );

      const result = await service.getOfflineCredentialsStatus('token');

      expect(result).toEqual({
        available: true,
        connected: false,
        schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
      });
      expect(schedulerConsent.getSchedulerServiceConsent).toHaveBeenCalledWith(
        'token',
        expect.any(AbortSignal),
      );
      expect(dialClient.client.getOfflineCredentials).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
      });
    });

    it('starts the consent read before the Core status call settles', async () => {
      const { service, dialClient, schedulerConsent } = makeService();
      let resolveStatus: (value: unknown) => void = () => undefined;
      vi.mocked(dialClient.client.getOfflineCredentials).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveStatus = resolve;
          }) as never,
      );

      const call = service.getOfflineCredentialsStatus('token');

      /* The consent read is in flight while the status call is still
       * pending — the two Core round-trips run in parallel. */
      expect(
        schedulerConsent.getSchedulerServiceConsent,
      ).toHaveBeenCalledOnce();

      resolveStatus(okResponse({ available: true, connected: false }));
      await expect(call).resolves.toMatchObject({
        schedulerServiceConsent: SchedulerServiceConsentStatus.SignedIn,
      });
    });

    it('defers the consent to unknown when the scheduler-metadata read stalls past the deadline', async () => {
      vi.useFakeTimers();
      const { service, dialClient, schedulerConsent } = makeService();
      vi.mocked(dialClient.client.getOfflineCredentials).mockResolvedValue(
        okResponse({ available: true, connected: true }),
      );
      schedulerConsent.getSchedulerServiceConsent.mockImplementation(
        (_token: string, signal: AbortSignal) =>
          new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () =>
              reject(new Error('The operation was aborted')),
            );
          }),
      );
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      const call = service.getOfflineCredentialsStatus('token');
      await vi.advanceTimersByTimeAsync(SCHEDULER_CONSENT_READ_TIMEOUT_MS);

      await expect(call).resolves.toEqual({
        available: true,
        connected: true,
        schedulerServiceConsent: SchedulerServiceConsentStatus.Unknown,
      });
      expect(warnSpy).toHaveBeenCalled();
    });

    it('debug-logs the status and raw body returned by Core', async () => {
      const { service, dialClient } = makeService();
      const coreResponse = {
        available: true,
        connected: false,
        connect: {
          authorization_endpoint: 'https://identity.example.com/authorize',
          client_id: 'dial-chat',
          scopes: ['openid', 'offline_access'],
        },
      };
      vi.mocked(dialClient.client.getOfflineCredentials).mockResolvedValue(
        okResponse(coreResponse),
      );
      const debugSpy = vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).logger,
        'debug',
      );

      await service.getOfflineCredentialsStatus('token');

      expect(debugSpy).toHaveBeenCalledWith(
        `DIAL Core getOfflineCredentials response: status=200 data=${JSON.stringify(coreResponse)}`,
      );
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

    it('relays a revoked scheduler service consent as signed_out', async () => {
      const { service, dialClient, schedulerConsent } = makeService();
      vi.mocked(dialClient.client.getOfflineCredentials).mockResolvedValue(
        okResponse({ available: false, connected: false }),
      );
      schedulerConsent.getSchedulerServiceConsent.mockResolvedValue(
        SchedulerServiceConsentStatus.SignedOut,
      );

      const result = await service.getOfflineCredentialsStatus('token');

      expect(result).toEqual({
        available: false,
        connected: false,
        schedulerServiceConsent: SchedulerServiceConsentStatus.SignedOut,
      });
    });

    it('returns unknown and still 200-shaped data when the consent read fails', async () => {
      const { service, dialClient, schedulerConsent } = makeService();
      vi.mocked(dialClient.client.getOfflineCredentials).mockResolvedValue(
        okResponse({ available: true, connected: true }),
      );
      schedulerConsent.getSchedulerServiceConsent.mockRejectedValue(
        new ServiceUnavailableException(
          'Scheduled tasks are not configured (SCHEDULER_APP_ID is missing)',
        ),
      );
      const warnSpy = vi
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      const result = await service.getOfflineCredentialsStatus('token');

      expect(result).toEqual({
        available: true,
        connected: true,
        schedulerServiceConsent: SchedulerServiceConsentStatus.Unknown,
      });
      expect(warnSpy).toHaveBeenCalled();
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

    it('logs the upstream status but never the sign-in error body', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignIn).mockResolvedValue(
        errResponse(400, {
          error: { message: 'Invalid authorization code' },
          detail: 'upstream-sensitive-detail',
        }),
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logger = (service as any).logger;
      const warnSpy = vi
        .spyOn(logger, 'warn')
        .mockImplementation(() => undefined);
      const debugSpy = vi
        .spyOn(logger, 'debug')
        .mockImplementation(() => undefined);

      await expect(
        service.signIn('token', {
          code: 'auth-code',
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
        }),
      ).rejects.toThrow('Invalid authorization code');

      expect(warnSpy).toHaveBeenCalledWith(
        'DIAL Core returned 400 for sign in offline-credentials',
      );
      const loggedText = JSON.stringify([
        ...warnSpy.mock.calls,
        ...debugSpy.mock.calls,
      ]);
      expect(loggedText).not.toContain('upstream-sensitive-detail');
      expect(loggedText).not.toContain('error body');
    });

    it('never includes the bearer token or code value in debug logs', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignIn).mockResolvedValue(
        okResponse(true),
      );
      const debugSpy = vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).logger,
        'debug',
      );

      const accessToken = 'super-secret-bearer-token';
      await service.signIn(accessToken, {
        code: 'super-secret-authorization-code',
        redirectUri: 'https://chat.example.com/auth/toolset-signin',
      });

      const loggedText = debugSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(loggedText).not.toContain(accessToken);
      expect(loggedText).not.toContain('super-secret-authorization-code');
    });

    it('debug-logs the Core status and result presence without the response body or authorization code', async () => {
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

      expect(debugSpy).toHaveBeenCalledWith(
        'DIAL Core offlineCredentialsSignIn response: status=200 dataPresent=true errorPresent=false',
      );
      const loggedText = debugSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(loggedText).not.toContain('super-secret-authorization-code');
    });
  });

  describe('signOut', () => {
    it('signs out successfully when Core resolves true', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignOut).mockResolvedValue(
        okResponse(true),
      );

      await service.signOut('token');

      expect(dialClient.client.offlineCredentialsSignOut).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
      });
    });

    it('treats a 404 from Core as idempotent success', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignOut).mockResolvedValue(
        errResponse(404),
      );

      await expect(service.signOut('token')).resolves.toBeUndefined();
    });

    it('treats a bodiless 404 from Core as idempotent success', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignOut).mockResolvedValue(
        errResponse(404, undefined),
      );

      await expect(service.signOut('token')).resolves.toBeUndefined();
    });

    it('maps a bodiless 5xx from Core to a 502', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignOut).mockResolvedValue(
        errResponse(500, undefined),
      );

      await expect(service.signOut('token')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('maps a falsy Core response to a 502, never a success', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignOut).mockResolvedValue(
        okResponse(false),
      );

      await expect(service.signOut('token')).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('propagates a mapped exception for a non-OK Core response other than 404', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignOut).mockResolvedValue(
        errResponse(400, { error: { message: 'Invalid request' } }),
      );

      await expect(service.signOut('token')).rejects.toThrow('Invalid request');
    });

    it('never includes the bearer token in debug logs', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.offlineCredentialsSignOut).mockResolvedValue(
        okResponse(true),
      );
      const debugSpy = vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).logger,
        'debug',
      );

      const accessToken = 'super-secret-bearer-token';
      await service.signOut(accessToken);

      const loggedText = debugSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(loggedText).not.toContain(accessToken);
    });
  });
});
