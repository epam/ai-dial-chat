import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScheduledTasksSortKey } from '../dto/list-scheduled-tasks-query.dto';
import { ScheduledTasksListCacheService } from '../scheduled-tasks-list-cache.service';
import { makeCacheManager } from './scheduled-tasks.fixtures';

const makeListCache = (cacheManager = makeCacheManager()) => ({
  cacheManager,
  listCache: new ScheduledTasksListCacheService(cacheManager as never),
});

describe('ScheduledTasksListCacheService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildKey', () => {
    it('defaults an empty query to epoch 0, no limit, offset 0 and firstToRun', async () => {
      const { listCache } = makeListCache();

      await expect(listCache.buildKey('user-1', {})).resolves.toBe(
        'scheduled-tasks:list:user-1:0::0::firstToRun',
      );
    });

    it('percent-encodes search and appends the model only when one is given', async () => {
      const { listCache } = makeListCache();

      await expect(
        listCache.buildKey('user-1', {
          limit: 20,
          offset: 40,
          search: 'daily: report',
          sort: ScheduledTasksSortKey.Newest,
        }),
      ).resolves.toBe(
        'scheduled-tasks:list:user-1:0:20:40:daily%3A%20report:newest',
      );
      await expect(
        listCache.buildKey('user-1', { model: 'gpt:4o' }),
      ).resolves.toBe('scheduled-tasks:list:user-1:0::0::firstToRun:gpt%3A4o');
    });

    it('keeps keys of different users apart', async () => {
      const { listCache } = makeListCache();

      const first = await listCache.buildKey('user-1', {});
      const second = await listCache.buildKey('user-2', {});

      expect(first).not.toBe(second);
    });
  });

  describe('invalidate', () => {
    it('bumps only the calling user epoch so their earlier keys become unreachable', async () => {
      const { listCache } = makeListCache();
      const before = await listCache.buildKey('user-1', {});
      const otherBefore = await listCache.buildKey('user-2', {});

      await listCache.invalidate('user-1');

      await expect(listCache.buildKey('user-1', {})).resolves.toBe(
        'scheduled-tasks:list:user-1:1::0::firstToRun',
      );
      expect(await listCache.buildKey('user-1', {})).not.toBe(before);
      expect(await listCache.buildKey('user-2', {})).toBe(otherBefore);
    });

    it('stores the epoch with a 24h TTL', async () => {
      const { listCache, cacheManager } = makeListCache();

      await listCache.invalidate('user-1');

      expect(cacheManager.set).toHaveBeenCalledWith(
        'scheduled-tasks:list-epoch:user-1',
        1,
        24 * 60 * 60 * 1000,
      );
    });

    it('logs and swallows a cache failure instead of failing the mutation', async () => {
      const cacheManager = makeCacheManager();
      cacheManager.set.mockRejectedValueOnce(new Error('cache down'));
      const { listCache } = makeListCache(cacheManager);
      const error = vi
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      await expect(listCache.invalidate('user-1')).resolves.toBeUndefined();
      expect(error).toHaveBeenCalledWith(
        'Unexpected error during invalidate scheduled tasks list cache (sub: user-1): Error',
        expect.any(String),
      );
    });
  });
});
