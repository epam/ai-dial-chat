import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { ProjectConversationStore } from '../../conversations/persistence/project-conversation.store';
import { getConversationTitleFromName } from '../../conversations/utils/conversation.utils';
import { DialClientService } from '../../dial/dial-client.service';
import {
  buildProjectConversationLocator,
  PROJECT_CONVERSATIONS_FOLDER,
} from '../utils/project-conversation-id.util';
import type { ParsedProjectId } from '../utils/project-id.util';
import { PROJECT_CONVERSATION_LIST_DEFAULT_LIMIT } from './dto/project-conversation-list-query.dto';
import type {
  ProjectConversationItemDto,
  ProjectConversationListResponseDto,
} from './dto/project-conversation-list-response.dto';

const LIST_CONTEXT = 'projects.conversations.list';
/* Core's largest page; the folder is flat, so pages are only files. */
const CORE_PAGE_LIMIT = 1000;
const TITLE_CACHE_PREFIX = 'projects:conversation-title:';
const TITLE_CACHE_TTL_MS = 10 * 60 * 1000;
/* Body reads one listing makes at once to resolve uncached titles. */
const TITLE_READ_CONCURRENCY = 4;

/** One file of Core's `listProjectFileMetadata` answer. */
interface CoreFileItem {
  name?: string;
  nodeType?: string;
  author?: string;
  updatedAt?: number;
}

interface CoreFileListing {
  items?: CoreFileItem[];
  nextToken?: string;
}

interface CachedTitle {
  updatedAt: number | undefined;
  title: string;
}

/* `openapi-fetch` resolves an empty-bodied error with `error: undefined`, so the status decides. */
const isFailed = (error: unknown, response: Response | undefined): boolean =>
  error != null || response == null || response.status >= 400;

const titleCacheKey = (locator: string): string =>
  `${TITLE_CACHE_PREFIX}${locator}`;

const newestFirst = (a: CoreFileItem, b: CoreFileItem): number => {
  const byTime = (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
  if (byTime !== 0) return byTime;
  if (a.name === b.name) return 0;
  return (a.name ?? '') < (b.name ?? '') ? -1 : 1;
};

/* Runs `task` over `items` with at most `limit` in flight, keeping order. */
const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
};

/**
 * Lists the conversations stored in a project's flat `conversations/`
 * folder, newest first. Titles come from each body's `name`, because a
 * renamed conversation keeps its file name, with the file-name title as the
 * fallback; they are cached per locator
 * while the listing's `updatedAt` is unchanged, and the write endpoints
 * evict them. Logs carry counts only, never names.
 */
@Injectable()
export class ProjectConversationsListService {
  private readonly logger = new Logger(ProjectConversationsListService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly store: ProjectConversationStore,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * @param project - the project to list
   * @param accessToken - caller's bearer token; Core checks read access
   * @param limit - page size, newest first
   */
  async listProjectConversations(
    project: ParsedProjectId,
    accessToken: string,
    limit = PROJECT_CONVERSATION_LIST_DEFAULT_LIMIT,
  ): Promise<ProjectConversationListResponseDto> {
    const files = (await this.listFiles(project, accessToken)).sort(
      newestFirst,
    );
    const page = files.slice(0, limit);
    const items = await mapWithConcurrency(
      page,
      TITLE_READ_CONCURRENCY,
      (file) => this.toItem(project, file, accessToken),
    );
    this.logger.debug(
      `Listed project conversations (total=${files.length}, returned=${items.length})`,
    );
    return { items, hasMore: files.length > page.length };
  }

  /** Drops the cached title of one conversation; called on every write through the project endpoints. */
  async evict(locator: string): Promise<void> {
    await this.cacheManager.del(titleCacheKey(locator));
  }

  private async listFiles(
    project: ParsedProjectId,
    accessToken: string,
  ): Promise<(CoreFileItem & { name: string })[]> {
    const files: (CoreFileItem & { name: string })[] = [];
    let token: string | undefined;
    do {
      let listing: CoreFileListing;
      try {
        const { data, error, response } =
          await this.dialClient.client.listProjectFileMetadata(
            project.bucket,
            encodeDialResourcePath(project.path),
            `${PROJECT_CONVERSATIONS_FOLDER}/`,
            {
              headers: getBearerAuthHeaders(accessToken),
              params: {
                query: {
                  limit: CORE_PAGE_LIMIT,
                  recursive: false,
                  ...(token ? { token } : {}),
                },
              },
            },
          );
        if (isFailed(error, response)) {
          /* A project without a `conversations/` folder has nothing to list. */
          if (response?.status === 404) return files;
          return handleDialSdkError(error, LIST_CONTEXT, this.logger, response);
        }
        listing = (data ?? {}) as CoreFileListing;
      } catch (err) {
        return handleDialSdkError(err, LIST_CONTEXT, this.logger);
      }
      for (const item of listing.items ?? []) {
        if (item.nodeType === 'ITEM' && item.name) {
          files.push({ ...item, name: item.name });
        }
      }
      token = listing.nextToken || undefined;
    } while (token);
    return files;
  }

  private async toItem(
    project: ParsedProjectId,
    file: CoreFileItem & { name: string },
    accessToken: string,
  ): Promise<ProjectConversationItemDto> {
    const locator = buildProjectConversationLocator(project, file.name);
    return {
      id: locator,
      name: file.name,
      title: await this.resolveTitle(locator, file, accessToken),
      ...(file.author != null ? { author: file.author } : {}),
      ...(file.updatedAt != null ? { updatedAt: file.updatedAt } : {}),
    };
  }

  private async resolveTitle(
    locator: string,
    file: CoreFileItem & { name: string },
    accessToken: string,
  ): Promise<string> {
    const key = titleCacheKey(locator);
    const cached = await this.cacheManager.get<CachedTitle>(key);
    if (cached != null && cached.updatedAt === file.updatedAt) {
      return cached.title;
    }

    const pathTitle = getConversationTitleFromName(file.name, false);
    try {
      const stored = await this.store.readConversationWithEtag(
        locator,
        accessToken,
      );
      if (stored == null) return pathTitle;
      const title = stored.conversation.name?.trim() || pathTitle;
      await this.cacheManager.set(
        key,
        { updatedAt: file.updatedAt, title } satisfies CachedTitle,
        TITLE_CACHE_TTL_MS,
      );
      return title;
    } catch (err) {
      this.logger.warn(
        `Project conversation title read failed (${err instanceof Error ? err.name : 'unknown error'}); using the file name`,
      );
      return pathTitle;
    }
  }
}
