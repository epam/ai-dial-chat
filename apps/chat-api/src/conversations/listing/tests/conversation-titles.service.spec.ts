import {
  BadGatewayException,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../../dial/dial-client.service';
import { ConversationTitleCacheService } from '../conversation-title-cache.service';
import { ConversationTitlesService } from '../conversation-titles.service';

const id = 'conversations/bucket/gpt-4o__Original';

describe('ConversationTitlesService', () => {
  let getConversation: ReturnType<typeof vi.fn>;
  let cache: ConversationTitleCacheService;
  let service: ConversationTitlesService;
  beforeEach(() => {
    getConversation = vi.fn().mockResolvedValue({
      data: {
        name: 'Renamed',
        llmNamingDone: true,
        messages: [{ content: 'Private body' }],
      },
      response: new Response(null, { status: 200 }),
    });
    cache = new ConversationTitleCacheService();
    service = new ConversationTitlesService(
      { client: { getConversation } } as unknown as DialClientService,
      cache,
    );
  });

  it('returns titles without messages, deduplicates reads and keeps the caller auth', async () => {
    const result = await service.getConversationTitles(
      [id, id],
      'secret-token',
    );
    expect(result).toEqual({ items: [{ id, title: 'Renamed' }] });
    expect(getConversation).toHaveBeenCalledOnce();
    expect(getConversation).toHaveBeenCalledWith(
      'bucket',
      'gpt-4o__Original',
      expect.objectContaining({
        headers: { Authorization: 'Bearer secret-token' },
      }),
    );
  });

  it('uses filename title unless the stored name is authoritative', async () => {
    getConversation.mockResolvedValue({
      data: { name: 'Not authoritative' },
      response: new Response(null, { status: 200 }),
    });
    expect(await service.getConversationTitles([id], 'token')).toEqual({
      items: [{ id, title: 'Original' }],
    });
  });

  it.each(['bucket', 'public', 'shared-owner'])(
    'reads the correct %s bucket and preserves literal escapes',
    async (bucket) => {
      const resourceId = `conversations/${bucket}/applications/public/pg/pg-agent%255F%255F1.0.0__New%20chat`;
      await service.getConversationTitles([resourceId], 'token');
      expect(getConversation).toHaveBeenCalledWith(
        bucket,
        'applications/public/pg/pg-agent%255F%255F1.0.0__New%20chat',
        expect.anything(),
      );
    },
  );

  it('preserves an encoded slash inside an application filename', async () => {
    const resourceId =
      'conversations/bucket/applications/public/Team%2FApp%20One__0.0.1__hello';
    await service.getConversationTitles([resourceId], 'token');
    expect(getConversation).toHaveBeenCalledWith(
      'bucket',
      'applications/public/Team%2FApp%20One__0.0.1__hello',
      expect.anything(),
    );
  });

  it('keeps successful titles when other resources are forbidden, missing, or unavailable', async () => {
    getConversation
      .mockResolvedValueOnce({
        error: 'missing',
        response: new Response(null, { status: 404 }),
      })
      .mockResolvedValueOnce({
        error: 'forbidden',
        response: new Response(null, { status: 403 }),
      })
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    const result = await service.getConversationTitles(
      [`${id}1`, `${id}2`, `${id}3`, id],
      'token',
    );
    expect(result).toEqual({ items: [{ id, title: 'Renamed' }] });
  });

  it('returns an empty projection when every resource is missing or inaccessible', async () => {
    getConversation.mockResolvedValue({
      error: 'missing',
      response: new Response(null, { status: 404 }),
    });
    expect(await service.getConversationTitles([id], 'token')).toEqual({
      items: [],
    });
  });

  it.each([
    { status: 502, exception: BadGatewayException },
    { status: 401, exception: UnauthorizedException },
    { status: 429, exception: ServiceUnavailableException },
  ])(
    'propagates a full upstream failure with status $status',
    async ({ status, exception }) => {
      getConversation.mockResolvedValue({
        error: 'failure',
        response: new Response(null, { status }),
      });
      await expect(
        service.getConversationTitles([id], 'token'),
      ).rejects.toBeInstanceOf(exception);
    },
  );

  it('returns 503 for a full network outage or timeout', async () => {
    getConversation.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      service.getConversationTitles([id], 'token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    getConversation.mockRejectedValue(
      new DOMException('timed out', 'TimeoutError'),
    );
    await expect(
      service.getConversationTitles([id], 'token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('propagates bounded queue overload when no titles can be resolved', async () => {
    vi.spyOn(cache, 'load').mockRejectedValue(
      new ServiceUnavailableException(),
    );
    await expect(
      service.getConversationTitles([id], 'token'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it.each([
    { ids: [] },
    { ids: Array<string>(26).fill(id) },
    { ids: ['bucket/gpt-4o__Original'] },
    { ids: ['conversations/bucket/%252e%252e/secret'] },
    { ids: ['conversations/bucket/valid%2F..%2Fsecret'] },
    { ids: ['conversations/bucket/name%0Ainjected'] },
    { ids: ['conversations/bucket/name%ZZ'] },
  ])(
    'rejects invalid batches before contacting Core: $ids',
    async ({ ids }) => {
      await expect(
        service.getConversationTitles(ids, 'token'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(getConversation).not.toHaveBeenCalled();
    },
  );
});
