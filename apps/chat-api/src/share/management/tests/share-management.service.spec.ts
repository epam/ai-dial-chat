import {
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  BadGatewayException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeploymentsService } from '../../../deployments/deployments.service';
import type { DialClientService } from '../../../dial/dial-client.service';
import type { ToolsetsService } from '../../../toolsets/toolsets.service';
import { ShareManagementService } from '../share-management.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

function makeService() {
  const dialClient = {
    client: {
      discardSharedResources: vi.fn(),
      revokeSharedResources: vi.fn(),
      getSharedResources: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const deploymentsService = {
    invalidateListCache: vi.fn().mockResolvedValue(undefined),
  } as unknown as DeploymentsService;

  const toolsetsService = {
    invalidateListCache: vi.fn().mockResolvedValue(undefined),
  } as unknown as ToolsetsService;

  const service = new ShareManagementService(
    dialClient,
    deploymentsService,
    toolsetsService,
  );
  return { service, dialClient, deploymentsService, toolsetsService };
}

describe('ShareManagementService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('discardShared', () => {
    const mockSharedResources = (
      service: ShareManagementService,
      resources: { url: string }[],
    ) =>
      vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
        .mockResolvedValue(okResponse({ resources }));

    it('calls DIAL Core discardSharedResources with the resource url and invalidates both caches on success', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      mockSharedResources(service, [
        { url: 'applications/owner-bucket/my-app' },
      ]);
      const spy = vi
        .spyOn(service['dialClient'].client, 'discardSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.discardShared(
        'applications/owner-bucket/my-app',
        'token-abc',
        'user-sub-1',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { resources: [{ url: 'applications/owner-bucket/my-app' }] },
      });
      expect(result).toEqual({ success: true });
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
      expect(toolsetsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    it('checks getSharedResources with the resource kind derived from a toolsets/ itemId', async () => {
      const { service } = makeService();
      const spy = mockSharedResources(service, [
        { url: 'toolsets/b/search__0.0.1' },
      ]);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(okResponse(undefined));

      await service.discardShared(
        'toolsets/b/search__0.0.1',
        'token-abc',
        'user-sub-1',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { resourceTypes: ['TOOL_SET'], with: 'me' },
      });
    });

    it('checks getSharedResources with the resource kind derived from a skills/ itemId and discards the whole skill', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      const sharedSpy = mockSharedResources(service, [
        { url: 'skills/owner-bucket/team-a/docs-helper' },
      ]);
      const discardSpy = vi
        .spyOn(service['dialClient'].client, 'discardSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.discardShared(
        'skills/owner-bucket/team-a/docs-helper',
        'token-abc',
        'user-sub-1',
      );

      expect(sharedSpy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { resourceTypes: ['SKILL'], with: 'me' },
      });
      expect(discardSpy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resources: [{ url: 'skills/owner-bucket/team-a/docs-helper' }],
        },
      });
      expect(result).toEqual({ success: true });
      /* Skills have no server-side list cache to invalidate (skills-bff-api
         cache decision), so this invalidation is a harmless no-op for a
         skill itemId — matching the conversation case below. */
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
      expect(toolsetsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    /*
     * Only prompts need `toShareResourceUrl` to re-encode `itemId` before it
     * reaches DIAL Core — every other kind's listing already passes through
     * whatever encoded/unencoded form DIAL Core itself uses for that url
     * (see `toShareResourceUrl`'s comment), so a skill name with a space is
     * sent through unchanged here, exactly as it was before prompts needed
     * this exception.
     */
    it('discards a shared skill whose name has a space, unmodified', async () => {
      const { service } = makeService();
      mockSharedResources(service, [
        { url: 'skills/owner-bucket/team a/docs helper' },
      ]);
      const discardSpy = vi
        .spyOn(service['dialClient'].client, 'discardSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.discardShared(
        'skills/owner-bucket/team a/docs helper',
        'token-abc',
        'user-sub-1',
      );

      expect(discardSpy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resources: [{ url: 'skills/owner-bucket/team a/docs helper' }],
        },
      });
      expect(result).toEqual({ success: true });
    });

    it('calls DIAL Core discardSharedResources with a conversation resource url unchanged', async () => {
      const { service } = makeService();
      mockSharedResources(service, [
        { url: 'conversations/owner-bucket/my-chat' },
      ]);
      const spy = vi
        .spyOn(service['dialClient'].client, 'discardSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.discardShared(
        'conversations/owner-bucket/my-chat',
        'token-abc',
        'user-sub-1',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { resources: [{ url: 'conversations/owner-bucket/my-chat' }] },
      });
      expect(result).toEqual({ success: true });
    });

    it('throws ForbiddenException and does not invalidate caches when DIAL Core silently no-ops a resource never shared with the caller', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      mockSharedResources(service, []);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(okResponse(undefined));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled();
      expect(toolsetsService.invalidateListCache).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when DIAL Core returns 400 for a well-formed itemId that does not resolve to a resource', async () => {
      const { service } = makeService();
      mockSharedResources(service, []);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(errResponse(400));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      mockSharedResources(service, []);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(errResponse(403));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      mockSharedResources(service, [{ url: 'applications/x/y' }]);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(errResponse(404));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      mockSharedResources(service, [{ url: 'applications/x/y' }]);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(errResponse(502));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      mockSharedResources(service, [{ url: 'applications/x/y' }]);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('propagates a getSharedResources failure instead of treating it as not shared', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(errResponse(502));
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(okResponse(undefined));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException when getSharedResources is unreachable', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockRejectedValue(new TypeError('fetch failed'));
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(okResponse(undefined));

      await expect(
        service.discardShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('discards a full prompts/{bucket}/{path} itemId, using the owner bucket embedded in it', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      const sharedSpy = mockSharedResources(service, [
        { url: 'prompts/owner-bucket/Work/AI/summarize' },
      ]);
      const discardSpy = vi
        .spyOn(service['dialClient'].client, 'discardSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.discardShared(
        'prompts/owner-bucket/Work/AI/summarize',
        'token-abc',
        'user-sub-1',
      );

      expect(sharedSpy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { resourceTypes: ['PROMPT'], with: 'me' },
      });
      expect(discardSpy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resources: [{ url: 'prompts/owner-bucket/Work/AI/summarize' }],
        },
      });
      expect(result).toEqual({ success: true });
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
      expect(toolsetsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    it('throws ForbiddenException for a prompt itemId not shared with the caller', async () => {
      const { service } = makeService();
      mockSharedResources(service, []);
      vi.spyOn(
        service['dialClient'].client,
        'discardSharedResources',
      ).mockResolvedValue(okResponse(undefined));

      await expect(
        service.discardShared(
          'prompts/owner-bucket/Work/AI/summarize',
          'token-abc',
          'user-sub-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('revokeShared', () => {
    it('calls DIAL Core revokeSharedResources with the resource url and invalidates both caches on success', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'revokeSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.revokeShared(
        'applications/owner-bucket/my-app',
        'token-abc',
        'user-sub-1',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { resources: [{ url: 'applications/owner-bucket/my-app' }] },
      });
      expect(result).toEqual({ success: true });
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
      expect(toolsetsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    it('passes a conversation resource url through unchanged', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'revokeSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.revokeShared(
        'conversations/owner-bucket/my-chat',
        'token-abc',
        'user-sub-1',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { resources: [{ url: 'conversations/owner-bucket/my-chat' }] },
      });
      expect(result).toEqual({ success: true });
    });

    it('revokes a skills/{bucket}/{path} resource url unchanged', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'revokeSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.revokeShared(
        'skills/owner-bucket/team-a/docs-helper',
        'token-abc',
        'user-sub-1',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resources: [{ url: 'skills/owner-bucket/team-a/docs-helper' }],
        },
      });
      expect(result).toEqual({ success: true });
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
      expect(toolsetsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    it('succeeds without checking whether the resource currently has recipients', async () => {
      const { service } = makeService();
      const sharedSpy = vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      );
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockResolvedValue(okResponse(undefined));

      const result = await service.revokeShared(
        'applications/owner-bucket/never-shared',
        'token-abc',
        'user-sub-1',
      );

      expect(sharedSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('throws NotFoundException when DIAL Core returns 400 for a well-formed itemId that does not resolve to a resource', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockResolvedValue(errResponse(400));

      await expect(
        service.revokeShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the caller does not own the resource', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockResolvedValue(errResponse(403));

      await expect(
        service.revokeShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(deploymentsService.invalidateListCache).not.toHaveBeenCalled();
      expect(toolsetsService.invalidateListCache).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockResolvedValue(errResponse(401));

      await expect(
        service.revokeShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockResolvedValue(errResponse(404));

      await expect(
        service.revokeShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('preserves the 429 status on upstream rate limiting', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockResolvedValue(errResponse(429));

      await expect(
        service.revokeShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockResolvedValue(errResponse(502));

      await expect(
        service.revokeShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'revokeSharedResources',
      ).mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.revokeShared('applications/x/y', 'token', 'user-sub-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('revokes a full prompts/{bucket}/{path} itemId, unmodified', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'revokeSharedResources')
        .mockResolvedValue(okResponse(undefined));

      const result = await service.revokeShared(
        'prompts/my-bucket/Work/AI/summarize',
        'token-abc',
        'user-sub-1',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resources: [{ url: 'prompts/my-bucket/Work/AI/summarize' }],
        },
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe('getRecipientsCount', () => {
    it('counts the accepted recipients of the requested resource', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
        .mockResolvedValue(
          okResponse({
            resources: [
              {
                url: 'applications/owner-bucket/my-app',
                sharedWith: [{ user: 'a' }, { user: 'b' }],
              },
              {
                url: 'applications/owner-bucket/other-app',
                sharedWith: [{ user: 'c' }],
              },
            ],
          }),
        );

      const result = await service.getRecipientsCount(
        'applications/owner-bucket/my-app',
        'token-abc',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resourceTypes: ['APPLICATION'],
          with: 'others',
          includeUserInfo: true,
        },
      });
      expect(result).toEqual({
        itemId: 'applications/owner-bucket/my-app',
        recipientsCount: 2,
      });
    });

    it('scopes the upstream query to the resource kind named by the itemId', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
        .mockResolvedValue(okResponse({ resources: [] }));

      await service.getRecipientsCount(
        'toolsets/owner-bucket/my-toolset',
        'token-abc',
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({ resourceTypes: ['TOOL_SET'] }),
        }),
      );
    });

    it('counts the accepted recipients of a shared skill', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
        .mockResolvedValue(
          okResponse({
            resources: [
              {
                url: 'skills/owner-bucket/team-a/docs-helper',
                sharedWith: [{ user: 'a' }],
              },
            ],
          }),
        );

      const result = await service.getRecipientsCount(
        'skills/owner-bucket/team-a/docs-helper',
        'token-abc',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resourceTypes: ['SKILL'],
          with: 'others',
          includeUserInfo: true,
        },
      });
      expect(result).toEqual({
        itemId: 'skills/owner-bucket/team-a/docs-helper',
        recipientsCount: 1,
      });
    });

    it('reports 0 for a resource a successful response does not mention', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(okResponse({ resources: [] }));

      const result = await service.getRecipientsCount(
        'applications/owner-bucket/never-shared',
        'token-abc',
      );

      expect(result).toEqual({
        itemId: 'applications/owner-bucket/never-shared',
        recipientsCount: 0,
      });
    });

    it('matches a percent-encoded conversation id against its decoded share url', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(
        okResponse({
          resources: [
            {
              url: 'conversations/owner-bucket/my chat',
              sharedWith: [{ user: 'a' }],
            },
          ],
        }),
      );

      const result = await service.getRecipientsCount(
        'conversations/owner-bucket/my%20chat',
        'token-abc',
      );

      expect(result.recipientsCount).toBe(1);
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(errResponse(401));

      await expect(
        service.getRecipientsCount('applications/x/y', 'token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockResolvedValue(errResponse(502));

      await expect(
        service.getRecipientsCount('applications/x/y', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'getSharedResources',
      ).mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.getRecipientsCount('applications/x/y', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('counts the accepted recipients of a full prompts/{bucket}/{path} itemId', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getSharedResources')
        .mockResolvedValue(
          okResponse({
            resources: [
              {
                url: 'prompts/my-bucket/Work/AI/summarize',
                sharedWith: [{ user: 'a' }],
              },
            ],
          }),
        );

      const result = await service.getRecipientsCount(
        'prompts/my-bucket/Work/AI/summarize',
        'token-abc',
      );

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          resourceTypes: ['PROMPT'],
          with: 'others',
          includeUserInfo: true,
        },
      });
      expect(result).toEqual({
        itemId: 'prompts/my-bucket/Work/AI/summarize',
        recipientsCount: 1,
      });
    });
  });
});
