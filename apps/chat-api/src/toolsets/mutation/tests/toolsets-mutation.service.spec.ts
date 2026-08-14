import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import {
  ToolsetAuthType,
  ToolsetTransport,
  type ToolsetBodyDto,
} from '../../dto/toolset-body.dto';
import { ToolsetsListingService } from '../../listing/toolsets-listing.service';
import { ToolsetsMutationService } from '../toolsets-mutation.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number, error: unknown = {}) =>
  ({ error, response: { status } as Response }) as never;

function makeDeps() {
  const dialClient = {
    client: {
      getToolSets: vi.fn(),
      getToolset: vi.fn(),
      getCustomToolSet: vi.fn(),
      getUserBucket: vi.fn(),
      saveToolSet: vi.fn(),
      deleteToolSet: vi.fn(),
      toolsetSignin: vi.fn(),
      toolSetSignout: vi.fn(),
      getSharedResources: vi
        .fn()
        .mockResolvedValue(okResponse({ resources: [] })),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const userConfigService = {
    getInstalledIds: vi
      .fn()
      .mockResolvedValue({ toolsets: [], deployments: [] }),
  };

  const deploymentsService = {
    invalidateDetailsCache: vi.fn().mockResolvedValue(undefined),
  };

  return { dialClient, userConfigService, deploymentsService };
}

function makeWriteService() {
  const { dialClient, userConfigService, deploymentsService } = makeDeps();
  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(undefined),
  };
  const listingService = new ToolsetsListingService(
    dialClient,
    cacheManager as never,
    userConfigService as never,
    deploymentsService as never,
  );
  const service = new ToolsetsMutationService(dialClient, listingService);
  return { service, cacheManager, deploymentsService };
}

const bucketSdkOk = okResponse({ bucket: 'test-bucket' });
const mutationSdkOk = okResponse({});

const baseBody: ToolsetBodyDto = {
  name: 'My toolset',
  endpoint: 'https://my-toolset.example.com/mcp',
  transport: ToolsetTransport.Http,
  authSettings: { authenticationType: ToolsetAuthType.None },
};

describe('ToolsetsMutationService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createToolset', () => {
    it('creates toolset, returns composite id, and invalidates the list cache', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        mutationSdkOk,
      );

      const result = await service.createToolset('user1', 'token', baseBody);
      expect(result).toEqual({
        id: 'toolsets/test-bucket/My%20toolset__0.0.1',
      });
      expect(cacheManager.del).toHaveBeenCalledWith('toolsets:list:user1');
    });

    it('encodes slashes inside the display name as filename characters', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      const result = await service.createToolset('user1', 'token', {
        ...baseBody,
        name: 'Team/toolset',
      });

      expect(result).toEqual({
        id: 'toolsets/test-bucket/Team%2Ftoolset__0.0.1',
      });
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'Team%2Ftoolset__0.0.1',
        expect.any(Object),
      );
    });

    it('maps fields to the DIAL Core PUT body shape', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        description: 'desc',
        iconUrl: 'https://example.com/icon.svg',
        topics: ['a', 'b'],
        allowedTools: ['tool1'],
        authSettings: {
          authenticationType: ToolsetAuthType.ApiKey,
          apiKeyHeader: 'X-Api-Key',
        },
      });

      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody).toEqual({
        displayName: 'My toolset',
        displayVersion: '0.0.1',
        endpoint: 'https://my-toolset.example.com/mcp',
        transport: 'HTTP',
        allowed_tools: ['tool1'],
        description: 'desc',
        iconUrl: 'https://example.com/icon.svg',
        descriptionKeywords: ['a', 'b'],
        authSettings: {
          authentication_type: 'API_KEY',
          api_key_header: 'X-Api-Key',
        },
      });
    });

    it('composes displayName/description as locale maps when locales is provided', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        description: 'desc',
        locales: [
          {
            language: 'de',
            name: 'Mein Toolset',
            description: 'Eine Beschreibung',
          },
        ],
        primaryLocale: 'en',
      });

      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody.displayName).toEqual({
        en: 'My toolset',
        de: 'Mein Toolset',
      });
      expect(sentBody.description).toEqual({
        en: 'desc',
        de: 'Eine Beschreibung',
      });
    });

    it('maps OAuth config fields to the DIAL Core PUT body', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          clientId: 'client-id',
          clientSecret: 'client-secret',
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
          scopesSupported: ['read', 'write'],
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toEqual({
        authentication_type: 'OAUTH',
        client_id: 'client-id',
        client_secret: 'client-secret',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        scopes_supported: ['read', 'write'],
        redirect_uri: 'https://chat.example.com/auth/toolset-signin',
      });
    });

    it('maps OAuth with-login redirect URI without requiring configured endpoints', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toEqual({
        authentication_type: 'OAUTH',
        redirect_uri: 'https://chat.example.com/auth/toolset-signin',
      });
    });

    it('allows configured OAuth without authorization and token endpoints (DIAL Core decides if that is enough)', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          clientId: 'client-id',
          clientSecret: 'client-secret',
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
          scopesSupported: ['read', 'write'],
        },
      });

      expect(saveSpy).toHaveBeenCalledOnce();
    });

    it('throws UnauthorizedException when the bucket call returns 401', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.createToolset('u', 't', baseBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not invalidate cache when the PUT returns an error', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockResolvedValue(
        bucketSdkOk,
      );
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(409),
      );
      await expect(
        service.createToolset('user1', 't', baseBody),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'getUserBucket').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.createToolset('u', 't', baseBody)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('updateToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('PUTs to the toolset id path and invalidates list + single caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      const result = await service.updateToolset(
        'user1',
        'token',
        id,
        baseBody,
      );
      expect(result).toEqual({ id });
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
          body: expect.objectContaining({
            displayName: 'My toolset',
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith('toolsets:list:user1');
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('replaces a previously plain-string displayName with a locale map when locales is provided', async () => {
      const { service } = makeWriteService();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.updateToolset('user1', 'token', id, {
        ...baseBody,
        locales: [{ language: 'de', name: 'Mein Toolset' }],
        primaryLocale: 'en',
      });

      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody.displayName).toEqual({
        en: 'My toolset',
        de: 'Mein Toolset',
      });
    });

    it('still produces a plain-string displayName when locales is omitted (regression guard)', async () => {
      const { service } = makeWriteService();
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.updateToolset('user1', 'token', id, baseBody);

      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody.displayName).toEqual('My toolset');
    });

    it('preserves hidden OAuth auth settings when update omits a new client secret', async () => {
      const { service } = makeWriteService();
      const customSpy = vi
        .spyOn(service['dialClient'].client, 'getCustomToolSet')
        .mockResolvedValue(
          okResponse({
            authSettings: {
              authentication_type: 'OAUTH',
              client_secret: 'existing-secret',
              code_verifier: 'existing-code-verifier',
              token_endpoint_auth_method: 'client_secret_post',
            },
          }),
        );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.updateToolset('user1', 'token', id, {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          clientId: 'updated-client',
          authorizationEndpoint: 'https://auth.example.com/authorize',
          tokenEndpoint: 'https://auth.example.com/token',
          scopesSupported: ['read', 'write'],
        },
      });

      expect(customSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toMatchObject({
        authentication_type: 'OAUTH',
        client_id: 'updated-client',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        scopes_supported: ['read', 'write'],
        client_secret: 'existing-secret',
      });
      expect(sentBody.authSettings).not.toHaveProperty('code_verifier');
      expect(sentBody.authSettings).not.toHaveProperty(
        'token_endpoint_auth_method',
      );
    });

    it('preserves the full stored OAuth config when update saves OAuth with-login only', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          authSettings: {
            authentication_type: 'OAUTH',
            client_id: 'existing-client',
            client_secret: 'existing-secret',
            authorization_endpoint: 'https://auth.example.com/authorize',
            token_endpoint: 'https://auth.example.com/token',
            scopes_supported: ['read', 'write'],
            code_verifier: 'existing-code-verifier',
            token_endpoint_auth_method: 'client_secret_post',
          },
        }),
      );
      const saveSpy = vi
        .spyOn(service['dialClient'].client, 'saveToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.updateToolset('user1', 'token', id, {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          redirectUri: 'https://chat.example.com/auth/toolset-signin',
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).toEqual({
        authentication_type: 'OAUTH',
        client_id: 'existing-client',
        client_secret: 'existing-secret',
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        scopes_supported: ['read', 'write'],
        redirect_uri: 'https://chat.example.com/auth/toolset-signin',
      });
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow(NotFoundException);
    });

    it('surfaces the DIAL Core error message (plain string body) on a rejected save', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(
          400,
          "Connection failed: The specified endpoint 'https://test.com' is invalid or unreachable.",
        ),
      );
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow(
        "Connection failed: The specified endpoint 'https://test.com' is invalid or unreachable.",
      );
    });

    it('surfaces the DIAL Core error message (object body with a message field) on a rejected save', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'saveToolSet').mockResolvedValue(
        errResponse(400, { message: 'Display name already in use' }),
      );
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow('Display name already in use');
    });
  });

  describe('deleteToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('DELETEs the toolset id path and invalidates caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const deleteSpy = vi
        .spyOn(service['dialClient'].client, 'deleteToolSet')
        .mockResolvedValue(mutationSdkOk);

      await service.deleteToolset('user1', 'token', id);
      expect(deleteSpy).toHaveBeenCalledWith(
        'test-bucket',
        'My%20toolset__0.0.1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'deleteToolSet').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.deleteToolset('u', 't', id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
