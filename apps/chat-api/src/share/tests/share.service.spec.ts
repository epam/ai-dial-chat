import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DeploymentsService } from '../../deployments/deployments.service';
import type { DialClientService } from '../../dial/dial-client.service';
import type { SkillsLookupService } from '../../skills/lookup/skills-lookup.service';
import type { ToolsetsService } from '../../toolsets/toolsets.service';
import { ShareAccess } from '../dto/create-share-link.dto';
import { ShareService } from '../share.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

function makeService(callbackBaseUrl = 'https://example.com/callback') {
  const dialClient = {
    client: {
      shareResource: vi.fn(),
      getInvitation: vi.fn(),
      discardSharedResources: vi.fn(),
      revokeSharedResources: vi.fn(),
      getSharedResources: vi.fn(),
    },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const configService = {
    get: vi.fn((key: string) =>
      key === 'AUTH_CALLBACK_BASE_URL' ? callbackBaseUrl : undefined,
    ),
  } as unknown as ConfigService<EnvironmentVariables>;

  const deploymentsService = {
    invalidateListCache: vi.fn().mockResolvedValue(undefined),
    resolveDeploymentItem: vi.fn().mockResolvedValue(null),
  } as unknown as DeploymentsService;

  const toolsetsService = {
    invalidateListCache: vi.fn().mockResolvedValue(undefined),
    resolveToolsetItem: vi.fn().mockResolvedValue(null),
  } as unknown as ToolsetsService;

  const skillsLookupService = {
    resolveSkillItem: vi.fn().mockResolvedValue(null),
  } as unknown as SkillsLookupService;

  const service = new ShareService(
    dialClient,
    configService,
    deploymentsService,
    toolsetsService,
    skillsLookupService,
  );
  return {
    service,
    dialClient,
    deploymentsService,
    toolsetsService,
    skillsLookupService,
  };
}

describe('ShareService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createShareLink', () => {
    it('maps a successful DIAL Core response to ShareLinkResponseDto', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockResolvedValue(
        okResponse({ invitationLink: '/v1/invitations/abc123' }),
      );

      const result = await service.createShareLink('token-abc', {
        itemId: 'gpt-4o',
        access: [ShareAccess.View],
      });

      expect(result).toEqual({
        url: 'https://example.com/catalog/shared/abc123',
        expiresInDays: 3,
        access: [ShareAccess.View],
      });
    });

    it('builds the frontend invitation URL from an absolute DIAL Core link', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockResolvedValue(
        okResponse({ invitationLink: 'https://dial-core/invite/abc' }),
      );

      const result = await service.createShareLink('token-abc', {
        itemId: 'gpt-4o',
        access: [ShareAccess.View],
      });

      expect(result.url).toBe('https://example.com/catalog/shared/abc');
    });

    it('forwards the Authorization header and requested permissions to DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'shareResource')
        .mockResolvedValue(okResponse({ invitationLink: '/invite/abc' }));

      await service.createShareLink('my-token', {
        itemId: 'my-app-id',
        access: [ShareAccess.View, ShareAccess.Edit],
      });

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer my-token' },
        body: {
          invitationType: 'LINK',
          resources: [{ url: 'my-app-id', permissions: ['READ', 'WRITE'] }],
        },
      });
    });

    it('routes conversation itemIds to the conversation accept-invitation path', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockResolvedValue(
        okResponse({ invitationLink: '/v1/invitations/conv-abc' }),
      );

      const result = await service.createShareLink('token-abc', {
        itemId: 'conversations/bucket/my-chat.json',
        access: [ShareAccess.View],
      });

      expect(result.url).toBe(
        'https://example.com/conversations/shared/conv-abc',
      );
    });

    it('creates a share link for a skills/{bucket}/{path} itemId', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'shareResource')
        .mockResolvedValue(
          okResponse({ invitationLink: '/v1/invitations/skill-abc' }),
        );

      const result = await service.createShareLink('token-abc', {
        itemId: 'skills/owner-bucket/team-a/docs-helper',
        access: [ShareAccess.View],
      });

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: {
          invitationType: 'LINK',
          resources: [
            {
              url: 'skills/owner-bucket/team-a/docs-helper',
              permissions: ['READ'],
            },
          ],
        },
      });
      expect(result.url).toBe('https://example.com/catalog/shared/skill-abc');
    });

    it('throws BadGatewayException when DIAL Core returns an empty invitation link', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockResolvedValue(
        okResponse({}),
      );

      await expect(
        service.createShareLink('token', {
          itemId: 'gpt-4o',
          access: [ShareAccess.View],
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException on upstream 502', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockResolvedValue(
        errResponse(502),
      );

      await expect(
        service.createShareLink('token', {
          itemId: 'gpt-4o',
          access: [ShareAccess.View],
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockRejectedValue(
        new TypeError('fetch failed'),
      );

      await expect(
        service.createShareLink('token', {
          itemId: 'gpt-4o',
          access: [ShareAccess.View],
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('acceptInvitation', () => {
    it('peeks the invitation for its itemId, then accepts it via DIAL Core', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'getInvitation')
        .mockResolvedValue(
          okResponse({ id: 'abc123', resources: [{ url: 'gpt-4o' }] }),
        );

      const result = await service.acceptInvitation(
        'token-abc',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(spy).toHaveBeenNthCalledWith(1, 'abc123', {
        headers: { Authorization: 'Bearer token-abc' },
      });
      expect(spy).toHaveBeenNthCalledWith(2, 'abc123', {
        headers: { Authorization: 'Bearer token-abc' },
        params: { query: { accept: true } },
      });
      expect(result).toEqual({ itemId: 'gpt-4o' });
      expect(deploymentsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
      expect(toolsetsService.invalidateListCache).toHaveBeenCalledWith(
        'user-sub-1',
      );
    });

    it('throws BadGatewayException when DIAL Core returns no shared resource', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        okResponse({ id: 'abc123', resources: [] }),
      );

      await expect(
        service.acceptInvitation('token', 'abc123', 'user-sub-1', 'bucket-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        errResponse(404),
      );

      await expect(
        service.acceptInvitation('token', 'missing', 'user-sub-1', 'bucket-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockRejectedValue(
        new TypeError('fetch failed'),
      );

      await expect(
        service.acceptInvitation('token', 'abc123', 'user-sub-1', 'bucket-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('treats a 400 "already belong to you" accept error as success instead of throwing', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation')
        .mockResolvedValueOnce(
          okResponse({ id: 'abc123', resources: [{ url: 'gpt-4o' }] }),
        )
        .mockResolvedValueOnce({
          error: 'Resource gpt-4o already belong to you',
          response: { status: 400 } as Response,
        } as never);

      const result = await service.acceptInvitation(
        'token',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(result).toEqual({ itemId: 'gpt-4o' });
    });

    it('still throws BadRequestException for a 400 accept error unrelated to already owning the resource', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation')
        .mockResolvedValueOnce(
          okResponse({ id: 'abc123', resources: [{ url: 'gpt-4o' }] }),
        )
        .mockResolvedValueOnce({
          error: 'Invitation has expired',
          response: { status: 400 } as Response,
        } as never);

      await expect(
        service.acceptInvitation('token', 'abc123', 'user-sub-1', 'bucket-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns sharedToolset for a toolsets/-prefixed itemId, without calling resolveDeploymentItem', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        okResponse({
          id: 'abc123',
          resources: [{ url: 'toolsets/b/search__0.0.1' }],
        }),
      );
      const sharedToolset = { id: 'toolsets/b/search__0.0.1', toolset: 'x' };
      vi.mocked(toolsetsService.resolveToolsetItem).mockResolvedValue(
        sharedToolset as never,
      );

      const result = await service.acceptInvitation(
        'token-abc',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(result).toEqual({
        itemId: 'toolsets/b/search__0.0.1',
        sharedToolset,
      });
      expect(toolsetsService.resolveToolsetItem).toHaveBeenCalledWith(
        'user-sub-1',
        'token-abc',
        'toolsets/b/search__0.0.1',
      );
      expect(deploymentsService.resolveDeploymentItem).not.toHaveBeenCalled();
    });

    it('returns sharedSkill for a skills/-prefixed itemId, without calling resolveDeploymentItem or resolveToolsetItem', async () => {
      const {
        service,
        deploymentsService,
        toolsetsService,
        skillsLookupService,
      } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        okResponse({
          id: 'abc123',
          resources: [{ url: 'skills/owner-bucket/team-a/docs-helper' }],
        }),
      );
      const sharedSkill = {
        name: 'docs-helper',
        path: 'team-a/docs-helper',
        url: 'skills/owner-bucket/team-a/docs-helper',
        bucket: 'owner-bucket',
        nodeType: 'item',
      };
      vi.mocked(skillsLookupService.resolveSkillItem).mockResolvedValue(
        sharedSkill as never,
      );

      const result = await service.acceptInvitation(
        'token-abc',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(result).toEqual({
        itemId: 'skills/owner-bucket/team-a/docs-helper',
        sharedSkill,
      });
      expect(skillsLookupService.resolveSkillItem).toHaveBeenCalledWith(
        'skills/owner-bucket/team-a/docs-helper',
        'token-abc',
        'bucket-1',
      );
      expect(deploymentsService.resolveDeploymentItem).not.toHaveBeenCalled();
      expect(toolsetsService.resolveToolsetItem).not.toHaveBeenCalled();
    });

    it('returns sharedDeployment for an applications/-prefixed itemId', async () => {
      const { service, deploymentsService } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        okResponse({
          id: 'abc123',
          resources: [{ url: 'applications/b/my-app__1.0' }],
        }),
      );
      const sharedDeployment = {
        id: 'applications/b/my-app__1.0',
        type: 'application',
      };
      vi.mocked(deploymentsService.resolveDeploymentItem).mockResolvedValue(
        sharedDeployment as never,
      );

      const result = await service.acceptInvitation(
        'token-abc',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(result).toEqual({
        itemId: 'applications/b/my-app__1.0',
        sharedDeployment,
      });
      expect(deploymentsService.resolveDeploymentItem).toHaveBeenCalledWith(
        'applications/b/my-app__1.0',
        'token-abc',
        'bucket-1',
      );
    });

    it('falls back to resolveToolsetItem for an ambiguous id when resolveDeploymentItem finds nothing', async () => {
      const { service, deploymentsService, toolsetsService } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        okResponse({
          id: 'abc123',
          resources: [{ url: 'root-toolset-copy' }],
        }),
      );
      vi.mocked(deploymentsService.resolveDeploymentItem).mockResolvedValue(
        null,
      );
      const sharedToolset = { id: 'root-toolset-copy', toolset: 'x' };
      vi.mocked(toolsetsService.resolveToolsetItem).mockResolvedValue(
        sharedToolset as never,
      );

      const result = await service.acceptInvitation(
        'token-abc',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(result).toEqual({
        itemId: 'root-toolset-copy',
        sharedToolset,
      });
    });

    it('omits both sharedDeployment and sharedToolset when nothing resolves', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        okResponse({ id: 'abc123', resources: [{ url: 'unknown-id' }] }),
      );

      const result = await service.acceptInvitation(
        'token-abc',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(result).toEqual({ itemId: 'unknown-id' });
    });

    it('still succeeds with only itemId when summary resolution throws', async () => {
      const { service, deploymentsService } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        okResponse({ id: 'abc123', resources: [{ url: 'gpt-4o' }] }),
      );
      vi.mocked(deploymentsService.resolveDeploymentItem).mockRejectedValue(
        new Error('upstream boom'),
      );

      const result = await service.acceptInvitation(
        'token-abc',
        'abc123',
        'user-sub-1',
        'bucket-1',
      );

      expect(result).toEqual({ itemId: 'gpt-4o' });
    });
  });

  describe('discardShared', () => {
    const mockSharedResources = (
      service: ShareService,
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
  });
});
