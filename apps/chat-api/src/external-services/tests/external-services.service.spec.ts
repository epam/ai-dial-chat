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

  describe('getExternalService', () => {
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
        APP_ID,
        SERVICE_ID,
        { headers: { Authorization: 'Bearer token' } },
      );
    });

    it('throws NotFoundException on a 404 from Core', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.getExternalService).mockResolvedValue(
        errResponse(404),
      );

      await expect(
        service.getExternalService('token', APP_ID, 'missing-service'),
      ).rejects.toBeInstanceOf(NotFoundException);
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
