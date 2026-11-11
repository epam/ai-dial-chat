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
  ConversationReadStateService,
  isProjectConversationUnread,
  type ProjectReadState,
} from '../../scheduled-task-unread/conversation-read-state.service';
import { ProjectSource } from '../dto/project-source.enum';
import { resolveProjectSource } from '../utils/project-access.util';
import { getLastMessageTime } from '../utils/project-conversation-activity.util';
import {
  buildProjectConversationLocator,
  PROJECT_CONVERSATIONS_FOLDER,
} from '../utils/project-conversation-id.util';
import type { ParsedProjectId } from '../utils/project-id.util';
import type {
  ProjectConversationItemDto,
  ProjectConversationListResponseDto,
} from './dto/project-conversation-list-response.dto';
import type { ProjectConversationTitlesResponseDto } from './dto/project-conversation-titles.dto';

const LIST_CONTEXT = 'projects.conversations.list';
/* Core's largest page; the folder is flat, so pages are only files. */
const CORE_PAGE_LIMIT = 1000;
const TITLE_CACHE_PREFIX = 'projects:conversation-title:';
const TITLE_CACHE_TTL_MS = 10 * 60 * 1000;
/* Body reads one listing makes at once to resolve uncached titles. */
const TITLE_READ_CONCURRENCY = 4;
/* The newest conversations whose bodies a listing reads: the design's first page of chats. */
const LIST_RESOLVED_COUNT = 20;

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
  /** Content version of the body the title was read from; decides the read state. */
  version?: string;
  /** Time of the body's last message; absent in an entry cached before it was kept, or for a chat without dated messages. */
  lastMessageAt?: number;
  /** The body was read for this entry, so an absent `lastMessageAt` is final and needs no re-read. */
  hasActivity?: boolean;
}

/** A title and the version it was read from; the version is unknown when the body could not be read. */
interface ResolvedTitle {
  title: string;
  version?: string;
  /** Time of the body's last message; unknown when the body was not read or has no dated message. */
  lastMessageAt?: number;
  /** The body was not read, so the title is the file-name one. */
  isPending?: boolean;
}

type ListedFile = CoreFileItem & { name: string };

/** A listing row with the time its position is decided by. */
interface ListedItem {
  item: ProjectConversationItemDto;
  lastMessageAt: number | undefined;
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

/* Rows without a known last message sink to the end, in name order. */
const byLastMessage = (a: ListedItem, b: ListedItem): number => {
  const byTime = (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0);
  if (byTime !== 0) return byTime;
  if (a.item.name === b.item.name) return 0;
  return a.item.name < b.item.name ? -1 : 1;
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
 * folder, newest first. Core cannot page this folder in display order, so
 * every listing reads the whole folder and returns all of it; the client
 * pages locally. Titles come from each body's `name`, because a renamed
 * conversation keeps its file name, with the file-name title as the
 * fallback. A listing reads the bodies of the newest conversations only and
 * marks the uncached rest pending; `resolveProjectConversations` reads them
 * on demand. Titles are cached per locator while the listing's `updatedAt`
 * is unchanged, and the write endpoints evict them. A published (organization)
 * project is the exception: publishing copies the files and stamps them all
 * with the copy time, so its listing reads every body and orders the chats by
 * their last message, resolving every title on the way. Logs carry counts
 * only, never names.
 */
@Injectable()
export class ProjectConversationsListService {
  private readonly logger = new Logger(ProjectConversationsListService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly store: ProjectConversationStore,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly readStateService: ConversationReadStateService,
  ) {}

  /**
   * @param project - the project to list
   * @param accessToken - caller's bearer token; Core checks read access
   * @param sessionBucket - caller's own bucket, which holds their read state
   */
  async listProjectConversations(
    project: ParsedProjectId,
    accessToken: string,
    sessionBucket: string,
  ): Promise<ProjectConversationListResponseDto> {
    const [listed, readState] = await this.readListing(
      project,
      accessToken,
      sessionBucket,
    );
    const files = listed.sort(newestFirst);
    /*
     * A published copy is read-only and its files all carry the time of the
     * copy, so the file order is meaningless there: every body is read and the
     * chats are ordered by their last message. Other projects keep Core's order.
     */
    const isPublished =
      resolveProjectSource(project.bucket, sessionBucket) ===
      ProjectSource.Organization;
    const resolvedCount = isPublished ? files.length : LIST_RESOLVED_COUNT;
    const [head, tail] = await Promise.all([
      mapWithConcurrency(
        files.slice(0, resolvedCount),
        TITLE_READ_CONCURRENCY,
        (file) =>
          this.toItem(project, file, accessToken, readState, true, isPublished),
      ),
      Promise.all(
        files
          .slice(resolvedCount)
          .map((file) =>
            this.toItem(project, file, accessToken, readState, false, false),
          ),
      ),
    ]);
    const rows = [...head, ...tail];
    if (isPublished) rows.sort(byLastMessage);
    const items = rows.map(({ item }) => item);
    this.logger.debug(
      `Listed project conversations (total=${items.length}, pending=${items.filter((item) => item.isTitlePending).length})`,
    );
    return { items };
  }

  /**
   * Resolves the titles and read state of the named conversations, reading
   * their bodies when the title cache misses.
   * @param project - the project the conversations belong to
   * @param names - file names under the project `conversations/` folder
   * @param accessToken - caller's bearer token; Core checks read access
   * @param sessionBucket - caller's own bucket, which holds their read state
   */
  async resolveProjectConversations(
    project: ParsedProjectId,
    names: string[],
    accessToken: string,
    sessionBucket: string,
  ): Promise<ProjectConversationTitlesResponseDto> {
    const [listed, readState] = await this.readListing(
      project,
      accessToken,
      sessionBucket,
    );
    /* The listing supplies `updatedAt` and `author`, and drops names the project does not hold. */
    const byName = new Map(listed.map((file) => [file.name, file]));
    const files = [...new Set(names)].flatMap((name) => {
      const file = byName.get(name);
      return file ? [file] : [];
    });
    const rows = await mapWithConcurrency(
      files,
      TITLE_READ_CONCURRENCY,
      (file) => this.toItem(project, file, accessToken, readState, true, false),
    );
    const items = rows.map(({ item }) => item);
    this.logger.debug(
      `Resolved project conversation titles (requested=${names.length}, returned=${items.length})`,
    );
    return { items };
  }

  /** Drops the cached title of one conversation; called on every write through the project endpoints. */
  async evict(locator: string): Promise<void> {
    await this.cacheManager.del(titleCacheKey(locator));
  }

  /* Never rejects on the read state: a failed one is `null`, so every chat reads as read. */
  private readListing(
    project: ParsedProjectId,
    accessToken: string,
    sessionBucket: string,
  ): Promise<[ListedFile[], ProjectReadState | null]> {
    return Promise.all([
      this.listFiles(project, accessToken),
      this.readStateService.getProjectReadState(
        project.id,
        accessToken,
        sessionBucket,
      ),
    ]);
  }

  private async listFiles(
    project: ParsedProjectId,
    accessToken: string,
  ): Promise<ListedFile[]> {
    const files: ListedFile[] = [];
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
    file: ListedFile,
    accessToken: string,
    readState: ProjectReadState | null,
    canReadBody: boolean,
    needsLastMessage: boolean,
  ): Promise<ListedItem> {
    const locator = buildProjectConversationLocator(project, file.name);
    const { title, version, lastMessageAt, isPending } =
      await this.resolveTitle(
        locator,
        file,
        accessToken,
        canReadBody,
        needsLastMessage,
      );
    return {
      lastMessageAt,
      item: {
        id: locator,
        name: file.name,
        title,
        ...(file.author != null ? { author: file.author } : {}),
        ...(file.updatedAt != null ? { updatedAt: file.updatedAt } : {}),
        isUnread:
          readState != null &&
          isProjectConversationUnread(
            readState,
            locator,
            file.updatedAt,
            version,
          ),
        ...(isPending ? { isTitlePending: true } : {}),
      },
    };
  }

  private async resolveTitle(
    locator: string,
    file: ListedFile,
    accessToken: string,
    canReadBody: boolean,
    needsLastMessage: boolean,
  ): Promise<ResolvedTitle> {
    const key = titleCacheKey(locator);
    const cached = await this.cacheManager.get<CachedTitle>(key);
    /*
     * An entry cached before versions were kept has none, and one cached before
     * the last message was kept lacks it; each is re-read once.
     */
    if (
      cached != null &&
      cached.updatedAt === file.updatedAt &&
      typeof cached.version === 'string' &&
      (!needsLastMessage || cached.hasActivity === true)
    ) {
      return {
        title: cached.title,
        version: cached.version,
        lastMessageAt: cached.lastMessageAt,
      };
    }

    const pathTitle = getConversationTitleFromName(file.name, false);
    if (!canReadBody) return { title: pathTitle, isPending: true };
    try {
      const stored = await this.store.readConversationWithEtag(
        locator,
        accessToken,
      );
      if (stored == null) return { title: pathTitle };
      const title = stored.conversation.name?.trim() || pathTitle;
      const version = stored.etag ?? undefined;
      const lastMessageAt = getLastMessageTime(stored.conversation);
      await this.cacheManager.set(
        key,
        {
          updatedAt: file.updatedAt,
          title,
          version,
          lastMessageAt,
          hasActivity: true,
        } satisfies CachedTitle,
        TITLE_CACHE_TTL_MS,
      );
      return { title, version, lastMessageAt };
    } catch (err) {
      this.logger.warn(
        `Project conversation title read failed (${err instanceof Error ? err.name : 'unknown error'}); using the file name`,
      );
      return { title: pathTitle };
    }
  }
}
