import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DeploymentsService } from '../../deployments/deployments.service';
import type { DialClientService } from '../../dial/dial-client.service';
import type { ToolsetsService } from '../../toolsets/toolsets.service';
import { ShareAccess } from '../dto/create-share-link.dto';
import { ShareService } from '../share.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

function makeService(callbackBaseUrl = 'https://example.com/callback') {
  const dialClient = {
    client: { shareResource: vi.fn(), getInvitation: vi.fn() },
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
  } as unknown as DeploymentsService;

  const toolsetsService = {
    invalidateListCache: vi.fn().mockResolvedValue(undefined),
  } as unknown as ToolsetsService;

  const service = new ShareService(
    dialClient,
    configService,
    deploymentsService,
    toolsetsService,
  );
  return { service, dialClient, deploymentsService, toolsetsService };
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
        service.acceptInvitation('token', 'abc123', 'user-sub-1'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockResolvedValue(
        errResponse(404),
      );

      await expect(
        service.acceptInvitation('token', 'missing', 'user-sub-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'getInvitation').mockRejectedValue(
        new TypeError('fetch failed'),
      );

      await expect(
        service.acceptInvitation('token', 'abc123', 'user-sub-1'),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
