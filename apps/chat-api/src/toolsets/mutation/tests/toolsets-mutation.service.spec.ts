import {
  ConflictException,
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
      getToolSetMetadata: vi.fn(),
      moveResource: vi.fn(),
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'saveToolSet',
      ).mockResolvedValue(mutationSdkOk);

      const result = await service.createToolset('user1', 'token', baseBody);
      expect(result).toEqual({
        id: 'toolsets/test-bucket/My%20toolset__1.0.0',
      });
      expect(cacheManager.del).toHaveBeenCalledWith('toolsets:list:user1');
    });

    it('encodes slashes inside the display name as filename characters', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
        .mockResolvedValue(mutationSdkOk);

      const result = await service.createToolset('user1', 'token', {
        ...baseBody,
        name: 'Team/toolset',
      });

      expect(result).toEqual({
        id: 'toolsets/test-bucket/Team%2Ftoolset__1.0.0',
      });
      expect(saveSpy).toHaveBeenCalledWith(
        'test-bucket',
        'Team%2Ftoolset__1.0.0',
        expect.any(Object),
      );
    });

    it('maps fields to the DIAL Core PUT body shape', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
        'My%20toolset__1.0.0',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody).toEqual({
        displayName: 'My toolset',
        displayVersion: '1.0.0',
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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

    it.each([
      ['a value', 'https://mcp.example.com/mcp'],
      ['a blank value, which clears it in DIAL Core', ''],
    ])('forwards an OAuth resource given as %s', async (_label, resource) => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.OAuth,
          clientId: 'client-id',
          resource,
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings.resource).toBe(resource);
    });

    it('drops a resource sent with a non-OAuth authentication type', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
        .mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        authSettings: {
          authenticationType: ToolsetAuthType.ApiKey,
          apiKeyHeader: 'X-Api-Key',
          resource: 'https://mcp.example.com/mcp',
        },
      });

      const sentBody = saveSpy.mock.calls[0][2].body as {
        authSettings: Record<string, unknown>;
      };
      expect(sentBody.authSettings).not.toHaveProperty('resource');
    });

    it('maps OAuth with-login redirect URI without requiring configured endpoints', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(errResponse(401));
      await expect(service.createToolset('u', 't', baseBody)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not invalidate cache when the PUT returns an error', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockResolvedValue(bucketSdkOk);
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'saveToolSet',
      ).mockResolvedValue(errResponse(409));
      await expect(
        service.createToolset('user1', 't', baseBody),
      ).rejects.toThrow();
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getUserBucket',
      ).mockRejectedValue(new TypeError('fetch failed'));
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
        .mockResolvedValue(mutationSdkOk);

      await service.updateToolset('user1', 'token', id, baseBody);

      const sentBody = saveSpy.mock.calls[0][2].body as Record<string, unknown>;
      expect(sentBody.displayName).toEqual('My toolset');
    });

    it('preserves hidden OAuth auth settings when update omits a new client secret', async () => {
      const { service } = makeWriteService();
      const customSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'getCustomToolSet',
        )
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
        (service['dialClient'] as DialClientService).client,
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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

    it('leaves an omitted resource to DIAL Core instead of re-sending the stored one', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          authSettings: {
            authentication_type: 'OAUTH',
            client_id: 'existing-client',
            client_secret: 'existing-secret',
            resource: 'https://mcp.example.com/mcp',
          },
        }),
      );
      const saveSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'saveToolSet',
        )
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
      expect(sentBody.authSettings).toMatchObject({
        client_id: 'existing-client',
        client_secret: 'existing-secret',
      });
      expect(sentBody.authSettings).not.toHaveProperty('resource');
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'saveToolSet',
      ).mockResolvedValue(errResponse(404));
      await expect(
        service.updateToolset('u', 't', id, baseBody),
      ).rejects.toThrow(NotFoundException);
    });

    it('surfaces the DIAL Core error message (plain string body) on a rejected save', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'saveToolSet',
      ).mockResolvedValue(
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'saveToolSet',
      ).mockResolvedValue(
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'deleteToolSet',
        )
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'deleteToolSet',
      ).mockResolvedValue(errResponse(403));
      await expect(service.deleteToolset('u', 't', id)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('personal folders', () => {
    const client = (service: ToolsetsMutationService) =>
      vi.mocked((service['dialClient'] as DialClientService).client);

    it('creates inside the requested folder with a create-only precondition', async () => {
      const { service } = makeWriteService();
      client(service).getUserBucket.mockResolvedValue(bucketSdkOk);
      client(service).saveToolSet.mockResolvedValue(mutationSdkOk);

      const result = await service.createToolset('user1', 'token', {
        ...baseBody,
        version: '1.1.0',
        folderPath: 'My Search',
        createOnly: true,
      });

      expect(result).toEqual({
        id: 'toolsets/test-bucket/My%20Search/My%20toolset__1.1.0',
      });
      expect(client(service).saveToolSet).toHaveBeenCalledWith(
        'test-bucket',
        'My%20Search/My%20toolset__1.1.0',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token', 'If-None-Match': '*' },
        }),
      );
    });

    it('never sends folderPath or createOnly to DIAL Core', async () => {
      const { service } = makeWriteService();
      client(service).getUserBucket.mockResolvedValue(bucketSdkOk);
      client(service).saveToolSet.mockResolvedValue(mutationSdkOk);

      await service.createToolset('user1', 'token', {
        ...baseBody,
        folderPath: 'Search',
        createOnly: true,
      });

      const [, , { body }] = client(service).saveToolSet.mock
        .calls[0] as never as [
        string,
        string,
        { body: Record<string, unknown> },
      ];
      expect(body).not.toHaveProperty('folderPath');
      expect(body).not.toHaveProperty('createOnly');
    });

    it('answers 409 when a create-only version already exists', async () => {
      const { service, cacheManager } = makeWriteService();
      client(service).getUserBucket.mockResolvedValue(bucketSdkOk);
      client(service).saveToolSet.mockResolvedValue(errResponse(412));

      await expect(
        service.createToolset('user1', 'token', {
          ...baseBody,
          createOnly: true,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(cacheManager.del).not.toHaveBeenCalled();
    });

    it('lists the folders of the caller bucket', async () => {
      const { service } = makeWriteService();
      client(service).getUserBucket.mockResolvedValue(bucketSdkOk);
      client(service).getToolSetMetadata.mockResolvedValue({
        data: { items: [{ name: 'Search', nodeType: 'FOLDER' }] },
        response: { status: 200 },
      } as never);

      await expect(service.listToolsetFolders('token', '')).resolves.toEqual({
        folders: [{ name: 'Search', path: 'Search' }],
      });
    });

    it('moves an own toolset into a folder and invalidates its caches', async () => {
      const { service, cacheManager } = makeWriteService();
      client(service).getUserBucket.mockResolvedValue(bucketSdkOk);
      client(service).moveResource.mockResolvedValue({
        response: { status: 200 },
      } as never);

      const result = await service.moveToolset(
        'user1',
        'token',
        'toolsets/test-bucket/search__1.0.0',
        'Search',
      );

      expect(result).toEqual({
        id: 'toolsets/test-bucket/Search/search__1.0.0',
      });
      expect(client(service).moveResource).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          sourceUrl: 'toolsets/test-bucket/search__1.0.0',
          destinationUrl: 'toolsets/test-bucket/Search/search__1.0.0',
          overwrite: false,
        },
      });
      expect(cacheManager.del).toHaveBeenCalledWith('toolsets:list:user1');
      expect(client(service).getCustomToolSet).not.toHaveBeenCalled();
    });

    it('rejects moving a toolset from another bucket', async () => {
      const { service } = makeWriteService();
      client(service).getUserBucket.mockResolvedValue(bucketSdkOk);

      await expect(
        service.moveToolset(
          'user1',
          'token',
          'toolsets/other/search__1.0.0',
          'Search',
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(client(service).moveResource).not.toHaveBeenCalled();
    });
  });
});
