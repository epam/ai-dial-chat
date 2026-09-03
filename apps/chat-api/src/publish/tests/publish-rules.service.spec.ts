import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { PublishRulesService } from '../publish-rules.service';

const okResponse = (data: unknown) =>
  ({ data, response: { ok: true, status: 200 } as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { ok: false, status } as Response }) as never;

/*
 * `openapi-fetch` short-circuits on an empty response body and returns
 * `{ error: undefined }` without reading it, even for a non-2xx status — see
 * the matching guard comment in `publish.service.ts`.
 */
const emptyBodyErrResponse = (status: number) =>
  ({ response: { ok: false, status } as Response }) as never;

const makeService = () => {
  const dialClient = {
    client: { getPublicationRules: vi.fn() },
  } as unknown as DialClientService;
  const service = new PublishRulesService(dialClient);
  return { service, dialClient };
};

describe('PublishRulesService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getRules', () => {
    it('returns the exact-match folder rules and builds the same public/-qualified url used by createPublication', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPublicationRules').mockResolvedValue(
        okResponse({
          rules: {
            'public/Organization/Data%20Science/Shared%20chats/': [
              { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
            ],
          },
        }),
      );

      const result = await service.getRules(
        'token-abc',
        'Organization/Data Science/Shared chats',
      );

      expect(dialClient.client.getPublicationRules).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token-abc' },
        body: { url: 'public/Organization/Data%20Science/Shared%20chats/' },
      });
      expect(result).toEqual([
        { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
      ]);
    });

    it('returns [] (not a 404) when the folder has no rules of its own', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPublicationRules').mockResolvedValue(
        okResponse({ rules: {} }),
      );

      const result = await service.getRules(
        'token-abc',
        'Organization/Empty Folder',
      );

      expect(result).toEqual([]);
    });

    it('discards ancestor-folder entries, returning only the exact requested folderPath', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPublicationRules').mockResolvedValue(
        okResponse({
          rules: {
            'public/Organization/': [
              { source: 'title', function: 'EQUAL', targets: ['Ancestor'] },
            ],
            'public/Organization/Data%20Science/': [
              { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
            ],
          },
        }),
      );

      const result = await service.getRules(
        'token-abc',
        'Organization/Data Science',
      );

      expect(result).toEqual([
        { source: 'role', function: 'CONTAIN', targets: ['engineering'] },
      ]);
    });

    it('maps an unexpected Core error to BadGatewayException', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPublicationRules').mockResolvedValue(
        errResponse(500),
      );

      await expect(
        service.getRules('token-abc', 'Organization/Data Science'),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('maps an unauthorized Core response to UnauthorizedException', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPublicationRules').mockResolvedValue(
        errResponse(401),
      );

      await expect(
        service.getRules('token-abc', 'Organization/Data Science'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('maps an unexpected thrown error to BadGatewayException', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPublicationRules').mockRejectedValue(
        new Error('boom'),
      );

      await expect(
        service.getRules('token-abc', 'Organization/Data Science'),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('maps a Core 500 with an empty response body to BadGatewayException instead of reporting success', async () => {
      const { service, dialClient } = makeService();
      vi.spyOn(dialClient.client, 'getPublicationRules').mockResolvedValue(
        emptyBodyErrResponse(500),
      );

      await expect(
        service.getRules('token-abc', 'Organization/Data Science'),
      ).rejects.toBeInstanceOf(BadGatewayException);
    });
  });
});
