import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ShareAccess } from '../dto/create-share-link.dto';
import { ShareService } from '../share.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

function makeService(callbackBaseUrl = 'https://chat.dialx.ai/callback') {
  const dialClient = {
    client: { shareResource: vi.fn() },
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
  } as unknown as DialClientService;

  const configService = {
    get: vi.fn(() => callbackBaseUrl),
  } as unknown as ConfigService;

  const service = new ShareService(dialClient, configService);
  return { service, dialClient };
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
        access: ShareAccess.View,
      });

      expect(result).toEqual({
        url: 'https://chat.dialx.ai/v1/invitations/abc123',
        expiresInDays: 3,
        access: ShareAccess.View,
      });
    });

    it('returns the invitation link unchanged when DIAL Core already returns an absolute URL', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockResolvedValue(
        okResponse({ invitationLink: 'https://dial-core/invite/abc' }),
      );

      const result = await service.createShareLink('token-abc', {
        itemId: 'gpt-4o',
        access: ShareAccess.View,
      });

      expect(result.url).toBe('https://dial-core/invite/abc');
    });

    it('forwards the Authorization header and requested permissions to DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['dialClient'].client, 'shareResource')
        .mockResolvedValue(okResponse({ invitationLink: '/invite/abc' }));

      await service.createShareLink('my-token', {
        itemId: 'my-app-id',
        access: ShareAccess.Edit,
      });

      expect(spy).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer my-token' },
        body: {
          invitationType: 'LINK',
          resources: [{ url: 'my-app-id', permissions: ['READ', 'WRITE'] }],
        },
      });
    });

    it('throws BadGatewayException when DIAL Core returns an empty invitation link', async () => {
      const { service } = makeService();
      vi.spyOn(service['dialClient'].client, 'shareResource').mockResolvedValue(
        okResponse({}),
      );

      await expect(
        service.createShareLink('token', {
          itemId: 'gpt-4o',
          access: ShareAccess.View,
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException on upstream 502', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'shareResource',
      ).mockResolvedValue(errResponse(502));

      await expect(
        service.createShareLink('token', {
          itemId: 'gpt-4o',
          access: ShareAccess.View,
        }),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(
        service['dialClient'].client,
        'shareResource',
      ).mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        service.createShareLink('token', {
          itemId: 'gpt-4o',
          access: ShareAccess.View,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
