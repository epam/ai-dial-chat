import { Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectConversationStore } from '../../conversations/persistence/project-conversation.store';
import type { DialClientService } from '../../dial/dial-client.service';
import { ProjectConversationsListService } from '../conversations/project-conversations-list.service';
import { parseProjectId } from '../utils/project-id.util';

const PROJECT = parseProjectId('projects/a1b2c3/support-quality')!;
const OLDER = 'gpt-4o__Older chat__1';
const NEWER = 'gpt-4o__Newer chat__2';

const listing = (items: unknown[], nextToken?: string) => ({
  data: { items, ...(nextToken ? { nextToken } : {}) },
  error: undefined,
  response: new Response(null, { status: 200 }),
});

const file = (name: string, updatedAt: number, author = 'Valery Tester') => ({
  name,
  nodeType: 'ITEM',
  author,
  updatedAt,
});

const makeCache = (): Cache => {
  const entries = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => entries.get(key)),
    set: vi.fn(async (key: string, value: unknown) => {
      entries.set(key, value);
      return value;
    }),
    del: vi.fn(async (key: string) => entries.delete(key)),
  } as unknown as Cache;
};

const makeService = (responses: unknown[]) => {
  const queue = [...responses];
  const client = {
    listProjectFileMetadata: vi.fn(async () => queue.shift()),
  };
  const store = {
    readConversationWithEtag: vi.fn(async (locator: string) => ({
      conversation: { name: `Body of ${locator.split('__')[1]}` },
      etag: '"sha256:x"',
    })),
  };
  const cache = makeCache();
  const service = new ProjectConversationsListService(
    { client } as unknown as DialClientService,
    store as unknown as ProjectConversationStore,
    cache as never,
  );
  return { service, client, store, cache };
};

describe('ProjectConversationsListService', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists the newest first with the body name as the title', async () => {
    const { service, client } = makeService([
      listing([file(OLDER, 1), file(NEWER, 2)]),
    ]);

    const result = await service.listProjectConversations(PROJECT, 'token');

    expect(result).toEqual({
      items: [
        {
          id: `projects/a1b2c3/support-quality/conversations/${NEWER}`,
          name: NEWER,
          title: 'Body of Newer chat',
          author: 'Valery Tester',
          updatedAt: 2,
        },
        expect.objectContaining({ name: OLDER, title: 'Body of Older chat' }),
      ],
      hasMore: false,
    });
    expect(client.listProjectFileMetadata).toHaveBeenCalledWith(
      'a1b2c3',
      'support-quality',
      'conversations/',
      expect.objectContaining({
        params: { query: expect.objectContaining({ recursive: false }) },
      }),
    );
  });

  it('follows Core cursors and applies the limit with hasMore', async () => {
    const { service, client } = makeService([
      listing([file('gpt-4o__A__1', 1)], 'next'),
      listing([file('gpt-4o__B__2', 2), file('gpt-4o__C__3', 3)]),
    ]);

    const result = await service.listProjectConversations(PROJECT, 'token', 2);

    expect(client.listProjectFileMetadata).toHaveBeenCalledTimes(2);
    expect(result.items.map((item) => item.name)).toEqual([
      'gpt-4o__C__3',
      'gpt-4o__B__2',
    ]);
    expect(result.hasMore).toBe(true);
  });

  it('skips folders under conversations/', async () => {
    const { service } = makeService([
      listing([{ name: 'nested', nodeType: 'FOLDER' }, file(OLDER, 1)]),
    ]);

    const result = await service.listProjectConversations(PROJECT, 'token');

    expect(result.items.map((item) => item.name)).toEqual([OLDER]);
  });

  it('reuses a cached title without reading the body while updatedAt is unchanged', async () => {
    const { service, store } = makeService([
      listing([file(OLDER, 1)]),
      listing([file(OLDER, 1)]),
    ]);

    await service.listProjectConversations(PROJECT, 'token');
    await service.listProjectConversations(PROJECT, 'token');

    expect(store.readConversationWithEtag).toHaveBeenCalledOnce();
  });

  it('re-reads the body when updatedAt changed or the title was evicted', async () => {
    const { service, store } = makeService([
      listing([file(OLDER, 1)]),
      listing([file(OLDER, 2)]),
      listing([file(OLDER, 2)]),
    ]);

    await service.listProjectConversations(PROJECT, 'token');
    await service.listProjectConversations(PROJECT, 'token');
    await service.evict(
      `projects/a1b2c3/support-quality/conversations/${OLDER}`,
    );
    await service.listProjectConversations(PROJECT, 'token');

    expect(store.readConversationWithEtag).toHaveBeenCalledTimes(3);
  });

  it('falls back to the file-name title when the body cannot be read', async () => {
    const { service, store } = makeService([listing([file(OLDER, 1)])]);
    store.readConversationWithEtag.mockRejectedValueOnce(new Error('boom'));

    const result = await service.listProjectConversations(PROJECT, 'token');

    expect(result.items[0].title).toBe('Older chat');
  });

  it('lists nothing when the project has no conversations folder', async () => {
    const { service } = makeService([
      {
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 404 }),
      },
    ]);

    await expect(
      service.listProjectConversations(PROJECT, 'token'),
    ).resolves.toEqual({ items: [], hasMore: false });
  });

  it('reads at most four bodies at a time', async () => {
    const names = Array.from({ length: 10 }, (_, i) => `gpt-4o__T${i}__${i}`);
    const { service, store } = makeService([
      listing(names.map((name, i) => file(name, i))),
    ]);
    let active = 0;
    let peak = 0;
    store.readConversationWithEtag.mockImplementation(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return { conversation: { name: 't' }, etag: null } as never;
    });

    await service.listProjectConversations(PROJECT, 'token');

    expect(peak).toBe(4);
  });
});
