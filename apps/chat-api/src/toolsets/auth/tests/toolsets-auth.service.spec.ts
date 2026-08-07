import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { ToolsetCredentialsLevel } from '../../dto/toolset-auth.dto';
import { ToolsetAuthType } from '../../dto/toolset-body.dto';
import { ToolsetsListingService } from '../../listing/toolsets-listing.service';
import { ToolsetsAuthService } from '../toolsets-auth.service';

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
  const service = new ToolsetsAuthService(dialClient, listingService);
  return { service, cacheManager, deploymentsService };
}

const mutationSdkOk = okResponse({});

describe('ToolsetsAuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('loginToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('posts API key credentials to the signin endpoint', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(service['dialClient'].client, 'toolsetSignin')
        .mockResolvedValue(mutationSdkOk);

      await service.loginToolset('user1', 'token', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.ApiKey,
        apiKey: 'secret-key',
      });

      expect(signinSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
        }),
      );
      const sentBody = signinSpy.mock.calls[0][0].body as Record<
        string,
        unknown
      >;
      expect(sentBody.apiKey).toBe('secret-key');
      expect(sentBody.code).toBeUndefined();
    });

    it('posts OAuth code + redirectUri to the signin endpoint', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(service['dialClient'].client, 'toolsetSignin')
        .mockResolvedValue(mutationSdkOk);

      await service.loginToolset('user1', 'token', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.OAuth,
        code: 'auth-code',
        redirectUri: 'https://chat.example.com/toolset-editor/callback',
      });

      const sentBody = signinSpy.mock.calls[0][0].body as Record<
        string,
        unknown
      >;
      expect(sentBody.code).toBe('auth-code');
      expect(sentBody.redirectUri).toBe(
        'https://chat.example.com/toolset-editor/callback',
      );
      expect(sentBody.apiKey).toBeUndefined();
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeWriteService();
      vi.spyOn(service['dialClient'].client, 'toolsetSignin').mockResolvedValue(
        errResponse(401),
      );
      await expect(
        service.loginToolset('u', 't', id, {
          url: id,
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthType.ApiKey,
          apiKey: 'k',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('derives url from the toolsetName path param, ignoring a mismatched body.url', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(service['dialClient'].client, 'toolsetSignin')
        .mockResolvedValue(mutationSdkOk);

      await service.loginToolset('user1', 'token', id, {
        url: 'toolsets/test-bucket/My%2520toolset__0.0.1',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.ApiKey,
        apiKey: 'secret-key',
      });

      const sentBody = signinSpy.mock.calls[0][0].body as Record<
        string,
        unknown
      >;
      expect(sentBody.url).toBe('toolsets/test-bucket/My toolset__0.0.1');
    });

    it('sends the raw (percent-decoded) resource reference as url', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(service['dialClient'].client, 'toolsetSignin')
        .mockResolvedValue(mutationSdkOk);

      await service.loginToolset('user1', 'token', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.ApiKey,
        apiKey: 'secret-key',
      });

      const sentBody = signinSpy.mock.calls[0][0].body as Record<
        string,
        unknown
      >;
      expect(sentBody.url).toBe('toolsets/test-bucket/My toolset__0.0.1');
    });
  });

  describe('logoutToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it('posts to the signout endpoint and invalidates caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const signoutSpy = vi
        .spyOn(service['dialClient'].client, 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.OAuth,
      });

      expect(signoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer token',
          }),
          body: expect.objectContaining({
            authenticationType: ToolsetAuthType.OAuth,
            credentialsLevel: ToolsetCredentialsLevel.User,
            url: 'toolsets/test-bucket/My toolset__0.0.1',
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('maps the App credentials level to the DIAL Core APPLICATION value', async () => {
      const { service } = makeWriteService();
      const signoutSpy = vi
        .spyOn(service['dialClient'].client, 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.App,
        authenticationType: ToolsetAuthType.ApiKey,
      });

      expect(signoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            credentialsLevel: 'APPLICATION',
          }),
        }),
      );
    });

    it('treats an upstream 404 as an already-signed-out no-op instead of an error', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'toolSetSignout',
      ).mockResolvedValue(errResponse(404));

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.Global,
        authenticationType: ToolsetAuthType.OAuth,
      });

      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('still throws for a non-404 upstream error', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'toolSetSignout',
      ).mockResolvedValue(errResponse(401));

      await expect(
        service.logoutToolset('user1', 'token', 'test-bucket', id, {
          url: id,
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthType.OAuth,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('resolves the authentication type from the stored toolset when the body omits it', async () => {
      const { service, cacheManager } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          displayName: 'My toolset',
          authSettings: { authentication_type: 'OAUTH' },
        }),
      );
      const signoutSpy = vi
        .spyOn(service['dialClient'].client, 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: id,
        credentialsLevel: ToolsetCredentialsLevel.User,
      });

      expect(signoutSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            authenticationType: ToolsetAuthType.OAuth,
          }),
        }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(
        `toolsets:single:user1:${id}`,
      );
    });

    it('rejects when the body omits authenticationType and the stored toolset has none supported', async () => {
      const { service } = makeWriteService();
      vi.spyOn(
        service['dialClient'].client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          displayName: 'My toolset',
          authSettings: { authentication_type: 'NONE' },
        }),
      );

      await expect(
        service.logoutToolset('user1', 'token', 'test-bucket', id, {
          url: id,
          credentialsLevel: ToolsetCredentialsLevel.User,
        }),
      ).rejects.toThrow('Unsupported toolset authentication type');
    });

    it('derives url from the toolsetName path param, ignoring a mismatched body.url', async () => {
      const { service } = makeWriteService();
      const signoutSpy = vi
        .spyOn(service['dialClient'].client, 'toolSetSignout')
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset('user1', 'token', 'test-bucket', id, {
        url: 'toolsets/test-bucket/My%2520toolset__0.0.1',
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.OAuth,
      });

      const sentBody = signoutSpy.mock.calls[0][0].body as Record<
        string,
        unknown
      >;
      expect(sentBody.url).toBe('toolsets/test-bucket/My toolset__0.0.1');
    });
  });
});
