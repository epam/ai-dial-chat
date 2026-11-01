import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { handleDialFetchError } from '../common/dial/dial-error.mapper';
import type { ListScheduledTasksQueryDto } from './dto/list-scheduled-tasks-query.dto';
import { ScheduledTasksSortKey } from './dto/list-scheduled-tasks-query.dto';

export const LIST_CACHE_TTL_MS = 30 * 1000;
const LIST_CACHE_EPOCH_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Per-user scheduled-tasks list cache keys and their invalidation. The list
 * itself is cached by `ScheduledTasksService.listScheduledTasks`; this owns
 * the key family and the epoch that makes old entries unreachable.
 */
@Injectable()
export class ScheduledTasksListCacheService {
  private readonly logger = new Logger(ScheduledTasksListCacheService.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  /*
   * cache-manager's `Cache` type has no key-enumeration/prefix-delete API, so
   * invalidating "every cached list variant for a user" (one per limit/offset/
   * search combination) can't be done by scanning keys. Instead, each user has
   * an "epoch" counter baked into their list cache keys; bumping the epoch on
   * create/update makes every previously cached variant unreachable without
   * needing to know or delete each key individually.
   */
  private listCacheEpochKey(userSub: string): string {
    return `scheduled-tasks:list-epoch:${userSub}`;
  }

  private async getListCacheEpoch(userSub: string): Promise<number> {
    return (
      (await this.cacheManager.get<number>(this.listCacheEpochKey(userSub))) ??
      0
    );
  }

  /*
   * `limit`/`offset` are always validated, delimiter-free digit sequences
   * (or the empty string), and `sort` is always one of the fixed enum
   * values, so none of the leading `:`-separated fields can ever be
   * ambiguous with each other or with `search`. `search` is still
   * percent-encoded before being embedded, purely so a colon in a search
   * term doesn't make the raw cache key/log line harder for a human to read.
   */
  private normalizeListQuery(query: ListScheduledTasksQueryDto): string {
    const limit = query.limit ?? '';
    const offset = query.offset ?? 0;
    const search = encodeURIComponent(query.search ?? '');
    const sort = query.sort ?? ScheduledTasksSortKey.FirstToRun;
    /*
     * Appended only when a model filter is present so the keys of unfiltered
     * lists stay exactly as before. Percent-encoded for the same reason as
     * `search`: a model id never carries a raw `:` into the key.
     */
    const model = query.model ? `:${encodeURIComponent(query.model)}` : '';
    return `${limit}:${offset}:${search}:${sort}${model}`;
  }

  async buildKey(
    userSub: string,
    query: ListScheduledTasksQueryDto,
  ): Promise<string> {
    const epoch = await this.getListCacheEpoch(userSub);
    return `scheduled-tasks:list:${userSub}:${epoch}:${this.normalizeListQuery(query)}`;
  }

  async invalidate(userSub: string): Promise<void> {
    try {
      const epoch = await this.getListCacheEpoch(userSub);
      await this.cacheManager.set(
        this.listCacheEpochKey(userSub),
        epoch + 1,
        LIST_CACHE_EPOCH_TTL_MS,
      );
    } catch (err) {
      handleDialFetchError(
        err,
        `invalidate scheduled tasks list cache (sub: ${userSub})`,
        this.logger,
        0,
        { swallow: true },
      );
    }
  }
}
