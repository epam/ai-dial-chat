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

const authResourceIds = [
  ['NS_toolset_1097_test', 'NS_toolset_1097_test'],
  ['NS_application_1097_test', 'NS_application_1097_test'],
  ['Platform%20toolset', 'Platform toolset'],
  [
    'toolsets/test-bucket/folder/My%20toolset__0.0.1',
    'toolsets/test-bucket/folder/My toolset__0.0.1',
  ],
  [
    'toolsets/test-bucket/100%25%20toolset__0.0.1',
    'toolsets/test-bucket/100% toolset__0.0.1',
  ],
];

describe('ToolsetsAuthService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['toolsets/bucket', 'toolsets//name'])(
    'rejects an incomplete bucket-qualified resource %s before sending credentials',
    async (toolsetName) => {
      const { service } = makeWriteService();
      const body = {
        url: toolsetName,
        credentialsLevel: ToolsetCredentialsLevel.User,
        authenticationType: ToolsetAuthType.ApiKey,
        apiKey: 'secret',
      };

      await expect(
        service.loginToolset('user1', 'token', toolsetName, body),
      ).rejects.toThrow('Toolset id must include bucket and path');
      await expect(
        service.logoutToolset(
          'user1',
          'token',
          'test-bucket',
          toolsetName,
          body,
        ),
      ).rejects.toThrow('Toolset id must include bucket and path');
      expect(
        (service['dialClient'] as DialClientService).client.toolsetSignin,
      ).not.toHaveBeenCalled();
      expect(
        (service['dialClient'] as DialClientService).client.toolSetSignout,
      ).not.toHaveBeenCalled();
    },
  );

  describe('loginToolset', () => {
    const id = 'toolsets/test-bucket/My%20toolset__0.0.1';

    it.each(authResourceIds)(
      'signs in %s with API key and OAuth credentials using its own identity',
      async (toolsetName, expectedUrl) => {
        for (const credentials of [
          { authenticationType: ToolsetAuthType.ApiKey, apiKey: 'secret' },
          {
            authenticationType: ToolsetAuthType.OAuth,
            code: 'auth-code',
            redirectUri: 'https://chat.example.com/auth/toolset-signin',
          },
        ]) {
          const { service, cacheManager } = makeWriteService();
          const signinSpy = vi
            .spyOn(
              (service['dialClient'] as DialClientService).client,
              'toolsetSignin',
            )
            .mockResolvedValue(mutationSdkOk);

          await service.loginToolset('user1', 'token', toolsetName, {
            url: 'different-resource',
            credentialsLevel: ToolsetCredentialsLevel.User,
            ...credentials,
          });

          expect(signinSpy).toHaveBeenCalledWith({
            headers: { Authorization: 'Bearer token' },
            body: {
              url: expectedUrl,
              credentialsLevel: ToolsetCredentialsLevel.User,
              ...credentials,
            },
          });
          expect(cacheManager.del).toHaveBeenCalledWith(
            `toolsets:single:user1:${toolsetName}`,
          );
        }
      },
    );

    it('posts API key credentials to the signin endpoint', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolsetSignin',
        )
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

    /*
     * Core gates every on-behalf-of mint on this flag, so a toolset signed in
     * without it works interactively and still fails with `consent-required`
     * the moment an application reaches for it in the background.
     */
    it('forwards offline usage consent, including an explicit decline', async () => {
      for (const consent of [true, false] as const) {
        const { service } = makeWriteService();
        const signinSpy = vi
          .spyOn(
            (service['dialClient'] as DialClientService).client,
            'toolsetSignin',
          )
          .mockResolvedValue(mutationSdkOk);

        await service.loginToolset('user1', 'token', id, {
          url: id,
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthType.ApiKey,
          apiKey: 'secret-key',
          offlineUsageConsent: consent,
        });

        const sentBody = signinSpy.mock.calls[0][0].body as Record<
          string,
          unknown
        >;
        expect(sentBody.offlineUsageConsent).toBe(consent);
      }
    });

    it('leaves offline usage consent unset when the caller did not ask', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolsetSignin',
        )
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
      expect(sentBody.offlineUsageConsent).toBeUndefined();
    });

    it('posts OAuth code + redirectUri to the signin endpoint', async () => {
      const { service } = makeWriteService();
      const signinSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolsetSignin',
        )
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
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'toolsetSignin',
      ).mockResolvedValue(errResponse(401));
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolsetSignin',
        )
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolsetSignin',
        )
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

    it.each(authResourceIds)(
      'signs out %s using its own identity',
      async (toolsetName, expectedUrl) => {
        const { service, cacheManager } = makeWriteService();
        const signoutSpy = vi
          .spyOn(
            (service['dialClient'] as DialClientService).client,
            'toolSetSignout',
          )
          .mockResolvedValue(mutationSdkOk);

        await service.logoutToolset(
          'user1',
          'token',
          'test-bucket',
          toolsetName,
          {
            url: 'different-resource',
            credentialsLevel: ToolsetCredentialsLevel.User,
            authenticationType: ToolsetAuthType.OAuth,
          },
        );

        expect(signoutSpy).toHaveBeenCalledWith({
          headers: { Authorization: 'Bearer token' },
          body: {
            url: expectedUrl,
            credentialsLevel: ToolsetCredentialsLevel.User,
            authenticationType: ToolsetAuthType.OAuth,
          },
        });
        expect(cacheManager.del).toHaveBeenCalledWith(
          `toolsets:single:user1:${toolsetName}`,
        );
      },
    );

    it('looks up the authentication type for a platform toolset without a bucket', async () => {
      const { service } = makeWriteService();
      const toolsetName = 'NS_toolset_1097_test';
      vi.spyOn(
        (service['dialClient'] as DialClientService).client,
        'getToolset',
      ).mockResolvedValue(
        okResponse({
          id: toolsetName,
          auth_settings: { authentication_type: 'API_KEY' },
        }),
      );
      const signoutSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolSetSignout',
        )
        .mockResolvedValue(mutationSdkOk);

      await service.logoutToolset(
        'user1',
        'token',
        'test-bucket',
        toolsetName,
        {
          url: toolsetName,
          credentialsLevel: ToolsetCredentialsLevel.User,
        },
      );

      expect(signoutSpy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          url: toolsetName,
          credentialsLevel: ToolsetCredentialsLevel.User,
          authenticationType: ToolsetAuthType.ApiKey,
        },
      });
    });

    it('posts to the signout endpoint and invalidates caches', async () => {
      const { service, cacheManager } = makeWriteService();
      const signoutSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolSetSignout',
        )
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolSetSignout',
        )
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
        (service['dialClient'] as DialClientService).client,
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
        (service['dialClient'] as DialClientService).client,
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
        (service['dialClient'] as DialClientService).client,
        'getCustomToolSet',
      ).mockResolvedValue(
        okResponse({
          displayName: 'My toolset',
          authSettings: { authentication_type: 'OAUTH' },
        }),
      );
      const signoutSpy = vi
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolSetSignout',
        )
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
        (service['dialClient'] as DialClientService).client,
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
        .spyOn(
          (service['dialClient'] as DialClientService).client,
          'toolSetSignout',
        )
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
