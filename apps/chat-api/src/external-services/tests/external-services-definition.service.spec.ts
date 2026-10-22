import {
  BadGatewayException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ExternalServiceAuthType } from '../dto/external-service.dto';
import { ExternalServicesService } from '../external-services.service';

const APP_ID = 'applications/bkt/loop__1.0.0';
const SERVICE_ID = 'teams';

const okResponse = (data: unknown) =>
  ({ data, response: { status: 200 } as Response }) as never;

const errResponse = (status: number, error: unknown = {}) =>
  ({ error, response: { status } as Response }) as never;

const makeService = () => {
  const dialClient = {
    client: {
      putExternalService: vi.fn(),
      deleteExternalService: vi.fn(),
    },
  } as unknown as DialClientService;
  return { service: new ExternalServicesService(dialClient), dialClient };
};

describe('ExternalServicesService — declaring and removing a service', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('putExternalService', () => {
    it('sends Core the definition in its own shape, with the bare app id and the session token', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.putExternalService).mockResolvedValue(
        okResponse({
          display_name: 'Teams bot',
          auth_settings: { authentication_type: 'API_KEY' },
        }),
      );

      const result = await service.putExternalService(
        'token',
        APP_ID,
        SERVICE_ID,
        {
          displayName: 'Teams bot',
          authSettings: {
            authenticationType: ExternalServiceAuthType.ApiKey,
            apiKeyHeader: 'X-Bot-Secret',
          },
        },
      );

      expect(dialClient.client.putExternalService).toHaveBeenCalledWith(
        'bkt/loop__1.0.0',
        SERVICE_ID,
        {
          headers: { Authorization: 'Bearer token' },
          body: {
            display_name: 'Teams bot',
            auth_settings: {
              authentication_type: 'API_KEY',
              api_key_header: 'X-Bot-Secret',
            },
          },
        },
      );
      expect(result.displayName).toBe('Teams bot');
      expect(result.authenticationType).toBe(ExternalServiceAuthType.ApiKey);
    });

    it('passes an OAuth client secret to Core and never returns it', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.putExternalService).mockResolvedValue(
        okResponse({
          display_name: 'GitLab',
          auth_settings: { authentication_type: 'OAUTH', client_id: 'c1' },
        }),
      );

      const result = await service.putExternalService(
        'token',
        APP_ID,
        'gitlab',
        {
          displayName: 'GitLab',
          authSettings: {
            authenticationType: ExternalServiceAuthType.OAuth,
            clientId: 'c1',
            clientSecret: 's3cret',
            authorizationEndpoint: 'https://gitlab.example.com/oauth/authorize',
            tokenEndpoint: 'https://gitlab.example.com/oauth/token',
            scopesSupported: ['read_repository'],
          },
        },
      );

      const sent = vi.mocked(dialClient.client.putExternalService).mock
        .calls[0][2] as { body: { auth_settings: Record<string, unknown> } };
      expect(sent.body.auth_settings.client_secret).toBe('s3cret');
      expect(JSON.stringify(result)).not.toContain('s3cret');
    });

    it('maps a Core refusal to the matching HTTP exception', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.putExternalService).mockResolvedValue(
        errResponse(403, { message: 'no write access' }),
      );
      await expect(
        service.putExternalService('token', APP_ID, SERVICE_ID, {
          displayName: 'x',
          authSettings: { authenticationType: ExternalServiceAuthType.ApiKey },
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('maps an unreachable Core to 503', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.putExternalService).mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.putExternalService('token', APP_ID, SERVICE_ID, {
          displayName: 'x',
          authSettings: { authenticationType: ExternalServiceAuthType.ApiKey },
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('deleteExternalService', () => {
    it('removes the service with the bare app id and the session token', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.deleteExternalService).mockResolvedValue(
        okResponse(undefined),
      );

      await service.deleteExternalService('token', APP_ID, SERVICE_ID);

      expect(dialClient.client.deleteExternalService).toHaveBeenCalledWith(
        'bkt/loop__1.0.0',
        SERVICE_ID,
        { headers: { Authorization: 'Bearer token' } },
      );
    });

    it('treats a service that is already gone as removed', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.deleteExternalService).mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.deleteExternalService('token', APP_ID, SERVICE_ID),
      ).resolves.toBeUndefined();
    });

    it('surfaces any other Core failure', async () => {
      const { service, dialClient } = makeService();
      vi.mocked(dialClient.client.deleteExternalService).mockResolvedValue(
        errResponse(500),
      );
      await expect(
        service.deleteExternalService('token', APP_ID, SERVICE_ID),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
