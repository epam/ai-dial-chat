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

const makeService = (responses: unknown[], readState: unknown = null) => {
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
  const readStateService = {
    getProjectReadState: vi.fn(async () => readState),
  };
  const service = new ProjectConversationsListService(
    { client } as unknown as DialClientService,
    store as unknown as ProjectConversationStore,
    cache as never,
    readStateService as never,
  );
  return { service, client, store, cache, readStateService };
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

    const result = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(result).toEqual({
      items: [
        {
          id: `projects/a1b2c3/support-quality/conversations/${NEWER}`,
          name: NEWER,
          title: 'Body of Newer chat',
          author: 'Valery Tester',
          updatedAt: 2,
          isUnread: false,
        },
        expect.objectContaining({ name: OLDER, title: 'Body of Older chat' }),
      ],
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

  it('follows Core cursors and lists every conversation', async () => {
    const { service, client } = makeService([
      listing([file('gpt-4o__A__1', 1)], 'next'),
      listing([file('gpt-4o__B__2', 2), file('gpt-4o__C__3', 3)]),
    ]);

    const result = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(client.listProjectFileMetadata).toHaveBeenCalledTimes(2);
    expect(result.items.map((item) => item.name)).toEqual([
      'gpt-4o__C__3',
      'gpt-4o__B__2',
      'gpt-4o__A__1',
    ]);
  });

  it('reads the bodies of the 20 newest only and marks the uncached rest pending', async () => {
    const names = Array.from({ length: 22 }, (_, i) => `gpt-4o__T${i}__${i}`);
    const { service, store } = makeService(
      [listing(names.map((name, i) => file(name, i + 1)))],
      { readBefore: 0, versions: new Map() },
    );

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(items).toHaveLength(22);
    expect(store.readConversationWithEtag).toHaveBeenCalledTimes(20);
    expect(items[19]).toEqual(
      expect.objectContaining({ title: 'Body of T2', isUnread: true }),
    );
    expect(items[19].isTitlePending).toBeUndefined();
    expect(items.slice(20)).toEqual([
      expect.objectContaining({
        name: 'gpt-4o__T1__1',
        title: 'T1',
        isUnread: false,
        isTitlePending: true,
      }),
      expect.objectContaining({
        name: 'gpt-4o__T0__0',
        title: 'T0',
        isUnread: false,
        isTitlePending: true,
      }),
    ]);
  });

  it('lists a cached title past the newest 20 without reading its body', async () => {
    const names = Array.from({ length: 21 }, (_, i) => `gpt-4o__T${i}__${i}`);
    const { service, store } = makeService([
      listing(names.map((name, i) => file(name, i + 1))),
      listing(names.map((name, i) => file(name, i + 1))),
    ]);
    await service.resolveProjectConversations(
      PROJECT,
      ['gpt-4o__T0__0'],
      'token',
      'a1b2c3',
    );
    store.readConversationWithEtag.mockClear();

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(store.readConversationWithEtag).toHaveBeenCalledTimes(20);
    expect(items[20]).toEqual(
      expect.objectContaining({ name: 'gpt-4o__T0__0', title: 'Body of T0' }),
    );
    expect(items[20].isTitlePending).toBeUndefined();
  });

  describe('resolveProjectConversations', () => {
    it('resolves the named conversations in request order and omits unknown names', async () => {
      const { service, store } = makeService([
        listing([file(OLDER, 1), file(NEWER, 2)]),
      ]);

      const { items } = await service.resolveProjectConversations(
        PROJECT,
        [OLDER, 'gpt-4o__Gone__9', NEWER, OLDER],
        'token',
        'a1b2c3',
      );

      expect(items).toEqual([
        expect.objectContaining({ name: OLDER, title: 'Body of Older chat' }),
        expect.objectContaining({ name: NEWER, title: 'Body of Newer chat' }),
      ]);
      expect(store.readConversationWithEtag).toHaveBeenCalledTimes(2);
    });

    it('reports the read state of a resolved conversation', async () => {
      const { service } = makeService([listing([file(OLDER, 5)])], {
        readBefore: 1,
        versions: new Map(),
      });

      const { items } = await service.resolveProjectConversations(
        PROJECT,
        [OLDER],
        'token',
        'a1b2c3',
      );

      expect(items[0].isUnread).toBe(true);
      expect(items[0].isTitlePending).toBeUndefined();
    });
  });

  it('skips folders under conversations/', async () => {
    const { service } = makeService([
      listing([{ name: 'nested', nodeType: 'FOLDER' }, file(OLDER, 1)]),
    ]);

    const result = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(result.items.map((item) => item.name)).toEqual([OLDER]);
  });

  it('reuses a cached title without reading the body while updatedAt is unchanged', async () => {
    const { service, store } = makeService([
      listing([file(OLDER, 1)]),
      listing([file(OLDER, 1)]),
    ]);

    await service.listProjectConversations(PROJECT, 'token', 'a1b2c3');
    await service.listProjectConversations(PROJECT, 'token', 'a1b2c3');

    expect(store.readConversationWithEtag).toHaveBeenCalledOnce();
  });

  it('re-reads the body when updatedAt changed or the title was evicted', async () => {
    const { service, store } = makeService([
      listing([file(OLDER, 1)]),
      listing([file(OLDER, 2)]),
      listing([file(OLDER, 2)]),
    ]);

    await service.listProjectConversations(PROJECT, 'token', 'a1b2c3');
    await service.listProjectConversations(PROJECT, 'token', 'a1b2c3');
    await service.evict(
      `projects/a1b2c3/support-quality/conversations/${OLDER}`,
    );
    await service.listProjectConversations(PROJECT, 'token', 'a1b2c3');

    expect(store.readConversationWithEtag).toHaveBeenCalledTimes(3);
  });

  it('falls back to the file-name title when the body cannot be read', async () => {
    const { service, store } = makeService([listing([file(OLDER, 1)])]);
    store.readConversationWithEtag.mockRejectedValueOnce(new Error('boom'));

    const result = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

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
      service.listProjectConversations(PROJECT, 'token', 'a1b2c3'),
    ).resolves.toEqual({ items: [] });
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

    await service.listProjectConversations(PROJECT, 'token', 'a1b2c3');

    expect(peak).toBe(4);
  });
});

describe('ProjectConversationsListService — published project', () => {
  const PUBLISHED = parseProjectId('projects/public/handbook')!;
  const iso = (time: number) => new Date(time).toISOString();

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const bodiesByTitle = (
    store: ReturnType<typeof makeService>['store'],
    times: Record<string, number[] | undefined>,
  ) => {
    store.readConversationWithEtag.mockImplementation((async (
      locator: string,
    ) => {
      const title = locator.split('__')[1];
      return {
        conversation: {
          name: title,
          messages: (times[title] ?? []).map((time) => ({
            timestamp: iso(time),
          })),
        },
        etag: '"sha256:x"',
      };
    }) as never);
  };

  it('orders the chats by their last message, not by the copy time of the files', async () => {
    const { service, store } = makeService([
      listing([
        file('gpt-4o__Old__1', 1000),
        file('gpt-4o__Newest__2', 1000),
        file('gpt-4o__Middle__3', 999),
      ]),
    ]);
    bodiesByTitle(store, {
      Old: [100, 200],
      Newest: [100, 900],
      Middle: [100, 500],
    });

    const { items } = await service.listProjectConversations(
      PUBLISHED,
      'token',
      'u-bucket',
    );

    expect(items.map((item) => item.title)).toEqual([
      'Newest',
      'Middle',
      'Old',
    ]);
  });

  it('reads every body past the first 20 and leaves no title pending', async () => {
    const names = Array.from({ length: 22 }, (_, i) => `gpt-4o__T${i}__${i}`);
    const { service, store } = makeService([
      listing(names.map((name) => file(name, 1000))),
    ]);
    bodiesByTitle(
      store,
      Object.fromEntries(names.map((_, i) => [`T${i}`, [i + 1]])),
    );

    const { items } = await service.listProjectConversations(
      PUBLISHED,
      'token',
      'u-bucket',
    );

    expect(store.readConversationWithEtag).toHaveBeenCalledTimes(22);
    expect(items[0].title).toBe('T21');
    expect(items[21].title).toBe('T0');
    expect(items.some((item) => item.isTitlePending)).toBe(false);
  });

  it('puts a chat without a dated message last, in name order', async () => {
    const { service, store } = makeService([
      listing([
        file('gpt-4o__B empty__1', 1000),
        file('gpt-4o__A empty__2', 1000),
        file('gpt-4o__Dated__3', 1000),
      ]),
    ]);
    bodiesByTitle(store, { Dated: [50] });

    const { items } = await service.listProjectConversations(
      PUBLISHED,
      'token',
      'u-bucket',
    );

    expect(items.map((item) => item.title)).toEqual([
      'Dated',
      'A empty',
      'B empty',
    ]);
  });

  it('reuses the cached last message while the file is unchanged', async () => {
    const { service, store } = makeService([
      listing([file('gpt-4o__Chat__1', 1000)]),
      listing([file('gpt-4o__Chat__1', 1000)]),
    ]);
    bodiesByTitle(store, { Chat: [10] });

    await service.listProjectConversations(PUBLISHED, 'token', 'u-bucket');
    await service.listProjectConversations(PUBLISHED, 'token', 'u-bucket');

    expect(store.readConversationWithEtag).toHaveBeenCalledOnce();
  });

  it('re-reads a body cached without its last message once', async () => {
    const { service, store, cache } = makeService([
      listing([file('gpt-4o__Chat__1', 1000)]),
    ]);
    bodiesByTitle(store, { Chat: [10] });
    await cache.set(
      'projects:conversation-title:projects/public/handbook/conversations/gpt-4o__Chat__1',
      { updatedAt: 1000, title: 'Chat', version: '"sha256:x"' },
    );

    await service.listProjectConversations(PUBLISHED, 'token', 'u-bucket');

    expect(store.readConversationWithEtag).toHaveBeenCalledOnce();
  });

  it('keeps the file order for a personal project', async () => {
    const { service, store } = makeService([
      listing([
        file('gpt-4o__FileNewest__1', 900),
        file('gpt-4o__FileOldest__2', 100),
      ]),
    ]);
    bodiesByTitle(store, { FileNewest: [1], FileOldest: [999] });

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(items.map((item) => item.title)).toEqual([
      'FileNewest',
      'FileOldest',
    ]);
  });

  it('keeps the file order for a project shared by another user', async () => {
    const shared = parseProjectId('projects/other1/handbook')!;
    const { service, store } = makeService([
      listing([
        file('gpt-4o__FileNewest__1', 900),
        file('gpt-4o__FileOldest__2', 100),
      ]),
    ]);
    bodiesByTitle(store, { FileNewest: [1], FileOldest: [999] });

    const { items } = await service.listProjectConversations(
      shared,
      'token',
      'a1b2c3',
    );

    expect(items.map((item) => item.title)).toEqual([
      'FileNewest',
      'FileOldest',
    ]);
  });
});

describe('ProjectConversationsListService — unread', () => {
  const LOCATOR = `projects/a1b2c3/support-quality/conversations/${NEWER}`;

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stateWith = (versions: [string, string][] = []) => ({
    readBefore: 100,
    versions: new Map(versions),
  });

  it("reads the caller's project read state from the session bucket", async () => {
    const { service, readStateService } = makeService(
      [listing([file(NEWER, 200)])],
      stateWith(),
    );

    await service.listProjectConversations(PROJECT, 'token', 'u-bucket');

    expect(readStateService.getProjectReadState).toHaveBeenCalledWith(
      PROJECT.id,
      'token',
      'u-bucket',
    );
  });

  it('reports a chat changed after the baseline and never viewed as unread', async () => {
    const { service } = makeService([listing([file(NEWER, 200)])], stateWith());

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(items[0].isUnread).toBe(true);
  });

  it('reports a chat viewed at its current version as read', async () => {
    const { service } = makeService(
      [listing([file(NEWER, 200)])],
      stateWith([[LOCATOR, '"sha256:x"']]),
    );

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(items[0].isUnread).toBe(false);
  });

  it('reports a chat older than the baseline as read', async () => {
    const { service } = makeService([listing([file(NEWER, 50)])], stateWith());

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(items[0].isUnread).toBe(false);
  });

  it('takes the version from the title cache without reading the body again', async () => {
    const { service, store } = makeService(
      [listing([file(NEWER, 200)]), listing([file(NEWER, 200)])],
      stateWith([[LOCATOR, 'sha256:old']]),
    );

    await service.listProjectConversations(PROJECT, 'token', 'a1b2c3');
    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(store.readConversationWithEtag).toHaveBeenCalledOnce();
    expect(items[0].isUnread).toBe(true);
  });

  it('reports a chat whose body cannot be read as read', async () => {
    const { service, store } = makeService(
      [listing([file(NEWER, 200)])],
      stateWith(),
    );
    store.readConversationWithEtag.mockRejectedValue(new Error('down'));

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(items[0].isUnread).toBe(false);
  });

  it('reports every chat as read when the read state is unavailable', async () => {
    const { service } = makeService(
      [listing([file(NEWER, 200), file(OLDER, 300)])],
      null,
    );

    const { items } = await service.listProjectConversations(
      PROJECT,
      'token',
      'a1b2c3',
    );

    expect(items.map((item) => item.isUnread)).toEqual([false, false]);
  });
});
