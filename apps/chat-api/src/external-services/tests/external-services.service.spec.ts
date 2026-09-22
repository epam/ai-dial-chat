import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import {
  ExternalServiceAuthType,
  ExternalServiceCredentialsLevel,
} from '../dto/external-service.dto';
import { ExternalServicesService } from '../external-services.service';

const APP_ID = 'applications/public/finhub-via-openapi__1.0.0';
const SERVICE_ID = 'finhub-api2';
const SCOPE_URL = `${APP_ID}/external_services/${SERVICE_ID}`;

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number, error: unknown = {}) =>
  ({ error, response: { status } as Response }) as never;

function makeService() {
  const dialClient = {
    client: {
      getExternalService: vi.fn(),
      getApplication: vi.fn(),
      getCustomApplication: vi.fn(),
      externalServiceSignIn: vi.fn(),
      externalServiceSignOut: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const service = new ExternalServicesService(dialClient);
  return { service, dialClient };
}

describe('ExternalServicesService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('listExternalServices', () => {
    it('lists readable inline services and strips secrets from OAuth metadata', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getApplication).mockResolvedValue(
        okResponse({
          external_services: {
            finance: {
              display_name: 'Finance',
              auth_settings: {
                authentication_type: 'OAUTH',
                client_id: 'client',
                client_secret: 'secret',
                code_verifier: 'verifier',
                user_level_auth_status: 'SIGNED_OUT',
              },
            },
            public: { display_name: 'Public API' },
          },
        }),
      );
      const result = await service.listExternalServices('token', APP_ID);
      expect(result).toEqual([
        expect.objectContaining({
          id: 'finance',
          displayName: 'Finance',
          authenticationType: 'OAUTH',
          clientId: 'client',
          userLevelAuthStatus: 'SIGNED_OUT',
        }),
        expect.objectContaining({ id: 'public', authenticationType: 'NONE' }),
      ]);
      expect(JSON.stringify(result)).not.toMatch(/secret|verifier/);
      expect(dialClient.client.getApplication).toHaveBeenCalledWith(APP_ID, {
        headers: { Authorization: 'Bearer token' },
      });
    });

    it('returns an empty list for an application without external services', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getApplication).mockResolvedValue(
        okResponse({}),
      );
      expect(
        await service.listExternalServices('token', 'platform-agent'),
      ).toEqual([]);
    });

    it('re-reads authentication statuses on every request', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getApplication)
        .mockResolvedValueOnce(
          okResponse({
            external_services: {
              finance: {
                auth_settings: { user_level_auth_status: 'SIGNED_OUT' },
              },
            },
          }),
        )
        .mockResolvedValueOnce(
          okResponse({
            external_services: {
              finance: {
                auth_settings: { user_level_auth_status: 'SIGNED_IN' },
              },
            },
          }),
        );
      expect(
        (await service.listExternalServices('token', APP_ID))[0]
          .userLevelAuthStatus,
      ).toBe('SIGNED_OUT');
      expect(
        (await service.listExternalServices('token', APP_ID))[0]
          .userLevelAuthStatus,
      ).toBe('SIGNED_IN');
    });

    it('propagates missing applications instead of presenting an empty form', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getApplication).mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.listExternalServices('token', APP_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects an empty upstream response', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getApplication).mockResolvedValue(
        okResponse(undefined),
      );
      await expect(
        service.listExternalServices('token', APP_ID),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('getExternalService', () => {
    it('reads enriched public metadata when an ordinary user cannot manage an inline service', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getExternalService).mockResolvedValue(
        errResponse(403),
      );
      vi.mocked(dialClient.client.getApplication).mockResolvedValue(
        okResponse({
          external_services: {
            [SERVICE_ID]: {
              display_name: 'Finance',
              auth_settings: {
                authentication_type: 'OAUTH',
                user_level_auth_status: 'SIGNED_IN',
              },
            },
          },
        }),
      );
      expect(
        await service.getExternalService('token', APP_ID, SERVICE_ID),
      ).toMatchObject({
        displayName: 'Finance',
        userLevelAuthStatus: 'SIGNED_IN',
      });
    });
    it('returns mapped metadata on success', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getExternalService).mockResolvedValue(
        okResponse({
          display_name: 'FinHub API',
          description: 'Financial data lookup service',
          auth_settings: { authentication_type: 'API_KEY' },
        }),
      );

      const result = await service.getExternalService(
        'token',
        APP_ID,
        SERVICE_ID,
      );

      expect(result).toEqual({
        displayName: 'FinHub API',
        description: 'Financial data lookup service',
        authenticationType: ExternalServiceAuthType.ApiKey,
      });
      expect(dialClient.client.getExternalService).toHaveBeenCalledWith(
        'public/finhub-via-openapi__1.0.0',
        SERVICE_ID,
        { headers: { Authorization: 'Bearer token' } },
      );
    });

    it('throws NotFoundException on a 404 from Core', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getExternalService).mockResolvedValue(
        errResponse(404),
      );
      // The application is unreadable too, so there is nothing to fall back to.
      vi.mocked(dialClient.client.getCustomApplication).mockResolvedValue(
        errResponse(403),
      );

      await expect(
        service.getExternalService('token', APP_ID, 'missing-service'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    /*
     * The management route reveals the inline `client_secret`, so Core serves
     * admin-declared services only to callers who can manage the application.
     * A user signing in to one through the sign-in interrupt is not such a
     * caller, and the OAuth settings the popup needs are public.
     */
    it('falls back to the application resource when the management route denies an inline service', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getExternalService).mockResolvedValue(
        errResponse(404),
      );
      vi.mocked(dialClient.client.getCustomApplication).mockResolvedValue(
        okResponse({
          external_services: {
            [SERVICE_ID]: {
              display_name: 'GitLab',
              auth_settings: {
                authentication_type: 'OAUTH',
                client_id: 'client-123',
                authorization_endpoint: 'https://git.example/oauth/authorize',
                scopes_supported: ['read_api'],
              },
            },
          },
        }),
      );

      const result = await service.getExternalService(
        'token',
        APP_ID,
        SERVICE_ID,
      );

      expect(result).toMatchObject({
        displayName: 'GitLab',
        authenticationType: ExternalServiceAuthType.OAuth,
        clientId: 'client-123',
        authorizationEndpoint: 'https://git.example/oauth/authorize',
        scopesSupported: ['read_api'],
      });
      expect(dialClient.client.getCustomApplication).toHaveBeenCalledWith(
        'public',
        'finhub-via-openapi__1.0.0',
        expect.anything(),
      );
    });

    it('reports the original 404 when the application declares no such service', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getExternalService).mockResolvedValue(
        errResponse(404),
      );
      vi.mocked(dialClient.client.getCustomApplication).mockResolvedValue(
        okResponse({ external_services: {} }),
      );

      await expect(
        service.getExternalService('token', APP_ID, 'missing-service'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not reach for the application on a non-404 failure', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getExternalService).mockResolvedValue(
        errResponse(403),
      );

      await expect(
        service.getExternalService('token', APP_ID, SERVICE_ID),
      ).rejects.toBeTruthy();
      expect(dialClient.client.getCustomApplication).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('signs in with an API key and reconstructs the scope id as url', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.externalServiceSignIn).mockResolvedValue(
        okResponse(true),
      );

      await service.signIn('token', APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'secret-key',
      });

      expect(dialClient.client.externalServiceSignIn).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          url: SCOPE_URL,
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
          apiKey: 'secret-key',
          code: undefined,
          redirectUri: undefined,
        },
      });
    });

    it('maps a falsy Core response to a 502', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.externalServiceSignIn).mockResolvedValue(
        okResponse(false),
      );

      await expect(
        service.signIn('token', APP_ID, SERVICE_ID, {
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
          apiKey: 'secret-key',
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it("surfaces Core's own rejection message for a 400 response", async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.externalServiceSignIn).mockResolvedValue(
        errResponse(400, {
          error: { message: 'Invalid external service scope id' },
        }),
      );

      const call = service.signIn('token', APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'secret-key',
      });

      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('Invalid external service scope id');
    });

    it('never includes apiKey or code in the debug log line', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.externalServiceSignIn).mockResolvedValue(
        okResponse(true),
      );
      const debugSpy = vi.spyOn(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (service as any).logger,
        'debug',
      );

      await service.signIn('token', APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
        apiKey: 'super-secret-value',
      });

      const loggedText = debugSpy.mock.calls.map((call) => call[0]).join('\n');
      expect(loggedText).not.toContain('super-secret-value');
    });
  });

  describe('signOut', () => {
    it('treats a 404 as idempotent success', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.externalServiceSignOut).mockResolvedValue(
        errResponse(404),
      );

      await expect(
        service.signOut('token', APP_ID, SERVICE_ID, {
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
        }),
      ).resolves.toBeUndefined();
    });

    it('propagates a non-404 error', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.externalServiceSignOut).mockResolvedValue(
        errResponse(500),
      );

      await expect(
        service.signOut('token', APP_ID, SERVICE_ID, {
          credentialsLevel: ExternalServiceCredentialsLevel.User,
          authenticationType: ExternalServiceAuthType.ApiKey,
        }),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it("surfaces Core's own rejection message for a 400 response", async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.externalServiceSignOut).mockResolvedValue(
        errResponse(400, {
          error: { message: 'nothing to sign out at this level' },
        }),
      );

      const call = service.signOut('token', APP_ID, SERVICE_ID, {
        credentialsLevel: ExternalServiceCredentialsLevel.User,
        authenticationType: ExternalServiceAuthType.ApiKey,
      });

      await expect(call).rejects.toBeInstanceOf(BadRequestException);
      await expect(call).rejects.toThrow('nothing to sign out at this level');
    });
  });
});
