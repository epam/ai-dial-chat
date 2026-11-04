import { Injectable, Logger } from '@nestjs/common';
import { safeDecodeURIComponent } from '../common/utils/uri';
import { parseScheduledTaskConversationPath } from '../conversations/utils/parse-scheduled-task-conversation-path';
import { DialClientService } from '../dial/dial-client.service';
import {
  ClientDataJsonFile,
  ClientDataReadKind,
  type ClientDataReadResult,
} from './client-data-json-file';
import {
  ConversationsReadBaseline,
  parseConversationsReadBaseline,
} from './dto/conversations-read-baseline.dto';
import {
  DEFAULT_VIEWED_CONVERSATIONS,
  parseViewedConversations,
  ViewedConversations,
} from './dto/viewed-conversations.dto';
import { ScheduledTaskUnreadService } from './scheduled-task-unread.service';

const READ_BASELINE_PATH = '.client_data/.conversations-read-baseline.json';
const VIEWED_CONVERSATIONS_PATH = '.client_data/.viewed-conversations.json';

/** What the list needs to decide whether a regular chat is unread. Viewed ids are URI-decoded. */
export interface RegularReadState {
  readBefore: number;
  viewedIds: ReadonlySet<string>;
}

/** What a project list needs to decide whether a project chat is unread. Keys are URI-decoded locators. */
export interface ProjectReadState {
  readBefore: number;
  /** Conversation locator → the content version the user last viewed. */
  versions: ReadonlyMap<string, string>;
}

/**
 * A project chat is unread when it changed after the baseline and its current
 * content version is not the one the user last viewed. Every reader keeps
 * their own versions, so a new answer turns unread for all of them; an
 * unknown time or version reads as read.
 */
export const isProjectConversationUnread = (
  state: ProjectReadState,
  conversationId: string,
  updatedAt: number | undefined,
  version: string | undefined,
): boolean =>
  updatedAt != null &&
  version != null &&
  updatedAt > state.readBefore &&
  state.versions.get(safeDecodeURIComponent(conversationId)) !== version;

type ProjectVersions = Record<string, string>;

/* The stored key of a project, matched URI-decoded like every other id. */
const findProjectKey = (
  projects: ViewedConversations['projectConversationIds'],
  projectId: string,
): string | undefined => {
  const target = safeDecodeURIComponent(projectId);
  return Object.keys(projects).find(
    (key) => safeDecodeURIComponent(key) === target,
  );
};

const omitKey = <T>(record: Record<string, T>, key: string) =>
  Object.fromEntries(
    Object.entries(record).filter(([entryKey]) => entryKey !== key),
  );

const sameVersions = (a: ProjectVersions, b: ProjectVersions): boolean => {
  const aKeys = Object.keys(a);
  return (
    aKeys.length === Object.keys(b).length &&
    aKeys.every((key) => b[key] === a[key])
  );
};

/**
 * A regular chat is unread when it was updated after the baseline and the user
 * has not seen it since. Ids are compared URI-decoded, like the other id sets.
 */
export const isRegularConversationUnread = (
  state: RegularReadState,
  conversationId: string,
  updatedAt: number,
): boolean =>
  updatedAt > state.readBefore &&
  !state.viewedIds.has(safeDecodeURIComponent(conversationId));

/**
 * Persists the read state of regular (non-scheduled) chats in the user's DIAL
 * Core client data: a one-time read-before baseline and the ids of chats the
 * user has seen. Scheduled runs keep their own file (`ScheduledTaskUnreadService`).
 */
@Injectable()
export class ConversationReadStateService {
  private readonly logger = new Logger(ConversationReadStateService.name);

  private readonly file: ClientDataJsonFile;

  constructor(
    dialClient: DialClientService,
    private readonly scheduledTaskUnreadService: ScheduledTaskUnreadService,
  ) {
    this.file = new ClientDataJsonFile(
      dialClient,
      this.logger,
      'conversation read state',
      'conversation-read-state',
    );
  }

  /**
   * Reads the baseline (creating it on first use) and the viewed ids. Fails
   * closed: `null` on any failed read or failed first write, so a transient
   * error never turns the whole history unread. Never throws.
   */
  async getReadState(
    token: string,
    bucket: string,
  ): Promise<RegularReadState | null> {
    try {
      const [baseline, viewed] = await Promise.all([
        this.file.read(READ_BASELINE_PATH, token, bucket),
        this.readViewed(token, bucket),
      ]);
      /* Only now, so a failed read of either file leaves both untouched. */
      const readBefore = await this.resolveBaseline(baseline, token, bucket);
      if (readBefore === null) return null;
      return {
        readBefore,
        viewedIds: new Set(viewed.conversationIds.map(safeDecodeURIComponent)),
      };
    } catch {
      this.logger.warn(
        'Failed to read conversation read state, treating regular chats as read',
      );
      return null;
    }
  }

  /**
   * Records that the user has seen a conversation. A scheduler run goes to the
   * scheduler viewed-ids file, any other chat to the viewed conversations file.
   * @throws HttpException when DIAL Core fails the read or the write.
   */
  markViewed(
    conversationId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    return parseScheduledTaskConversationPath(conversationId)
      ? this.scheduledTaskUnreadService.markViewed(
          conversationId,
          token,
          bucket,
        )
      : this.addViewed(conversationId, token, bucket);
  }

  /**
   * Makes a regular chat unseen again because a new generation is starting.
   * Scheduler runs are never un-viewed. Best effort and never throws: a failed
   * read-state write must not fail the generation it accompanies, so it is
   * logged and swallowed.
   */
  async markUnviewed(
    conversationId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    if (parseScheduledTaskConversationPath(conversationId)) return;
    try {
      await this.removeViewed(conversationId, token, bucket);
    } catch (error) {
      this.logger.warn('Failed to mark conversation as unviewed', error);
    }
  }

  /**
   * The stored baseline only, for callers that need nothing else (a rename).
   * Never creates the baseline and never throws: `null` when the file is
   * missing, malformed or cannot be read.
   */
  async getReadBefore(token: string, bucket: string): Promise<number | null> {
    try {
      const result = await this.file.read(READ_BASELINE_PATH, token, bucket);
      return result.kind === ClientDataReadKind.Ok
        ? parseConversationsReadBaseline(result.value)
        : null;
    } catch {
      this.logger.warn('Failed to read the conversation read baseline');
      return null;
    }
  }

  /** @throws HttpException when DIAL Core fails the read or the write. */
  async addViewed(
    conversationId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const viewed = await this.readViewed(token, bucket);
    if (this.includes(viewed, conversationId)) return;
    await this.writeViewed(
      {
        ...viewed,
        conversationIds: [...viewed.conversationIds, conversationId],
      },
      token,
      bucket,
    );
  }

  /** @throws HttpException when DIAL Core fails the read or the write. */
  async removeViewed(
    conversationId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const viewed = await this.readViewed(token, bucket);
    if (!this.includes(viewed, conversationId)) return;
    const target = safeDecodeURIComponent(conversationId);
    await this.writeViewed(
      {
        ...viewed,
        conversationIds: viewed.conversationIds.filter(
          (id) => safeDecodeURIComponent(id) !== target,
        ),
      },
      token,
      bucket,
    );
  }

  /**
   * Reads the baseline (creating it on first use) and the user's viewed
   * versions of one project's chats. Fails closed like `getReadState`: `null`
   * on any failed read or failed first write. Never throws.
   */
  async getProjectReadState(
    projectId: string,
    token: string,
    bucket: string,
  ): Promise<ProjectReadState | null> {
    try {
      const [baseline, viewed] = await Promise.all([
        this.file.read(READ_BASELINE_PATH, token, bucket),
        this.readViewed(token, bucket),
      ]);
      const readBefore = await this.resolveBaseline(baseline, token, bucket);
      if (readBefore === null) return null;
      const key = findProjectKey(viewed.projectConversationIds, projectId);
      const stored = key ? viewed.projectConversationIds[key] : {};
      return {
        readBefore,
        versions: new Map(
          Object.entries(stored).map(([id, version]) => [
            safeDecodeURIComponent(id),
            version,
          ]),
        ),
      };
    } catch {
      this.logger.warn(
        'Failed to read project read state, treating project chats as read',
      );
      return null;
    }
  }

  /**
   * Records the content version of a project chat the user has seen.
   * @throws HttpException when DIAL Core fails the read or the write.
   */
  markProjectConversationViewed(
    projectId: string,
    conversationId: string,
    version: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const id = safeDecodeURIComponent(conversationId);
    return this.updateProject(projectId, token, bucket, (versions) => ({
      ...versions,
      [id]: version,
    }));
  }

  /**
   * Moves the caller's viewed version of a project chat from `fromVersion` to
   * `toVersion` after a write the user did not see as a change (the
   * background display name), so it does not turn their read chat unread. A
   * chat viewed at another version, or never viewed, is left alone.
   * @throws HttpException when DIAL Core fails the read or the write.
   */
  carryProjectConversationViewed(
    projectId: string,
    conversationId: string,
    fromVersion: string,
    toVersion: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const target = safeDecodeURIComponent(conversationId);
    return this.updateProject(projectId, token, bucket, (versions) => {
      const key = Object.keys(versions).find(
        (id) => safeDecodeURIComponent(id) === target,
      );
      return key != null && versions[key] === fromVersion
        ? { ...versions, [key]: toVersion }
        : versions;
    });
  }

  /** @throws HttpException when DIAL Core fails the read or the write. */
  removeProjectConversation(
    projectId: string,
    conversationId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const target = safeDecodeURIComponent(conversationId);
    return this.updateProject(projectId, token, bucket, (versions) =>
      Object.fromEntries(
        Object.entries(versions).filter(
          ([id]) => safeDecodeURIComponent(id) !== target,
        ),
      ),
    );
  }

  /** @throws HttpException when DIAL Core fails the read or the write. */
  removeProject(projectId: string, token: string, bucket: string) {
    return this.updateProject(projectId, token, bucket, () => ({}));
  }

  /**
   * Moves a project's entry to its new id after a rename, rewriting every
   * locator's project prefix. The versions are kept: a move copies the files
   * byte for byte. Values moved in win over an entry already under `newId`.
   * @throws HttpException when DIAL Core fails the read or the write.
   */
  async renameProject(
    oldId: string,
    newId: string,
    token: string,
    bucket: string,
  ): Promise<void> {
    const viewed = await this.readViewed(token, bucket);
    const oldKey = findProjectKey(viewed.projectConversationIds, oldId);
    if (oldKey == null) return;
    const oldPrefix = `${safeDecodeURIComponent(oldId)}/`;
    const newPrefix = `${safeDecodeURIComponent(newId)}/`;
    const moved: ProjectVersions = {};
    for (const [id, version] of Object.entries(
      viewed.projectConversationIds[oldKey],
    )) {
      const decoded = safeDecodeURIComponent(id);
      const rewritten = decoded.startsWith(oldPrefix)
        ? `${newPrefix}${decoded.slice(oldPrefix.length)}`
        : decoded;
      moved[rewritten] = version;
    }
    const rest = omitKey(viewed.projectConversationIds, oldKey);
    const newKey = findProjectKey(rest, newId) ?? safeDecodeURIComponent(newId);
    await this.writeViewed(
      {
        ...viewed,
        projectConversationIds: {
          ...rest,
          [newKey]: { ...rest[newKey], ...moved },
        },
      },
      token,
      bucket,
    );
  }

  /* Read-modify-write of one project's versions; no upload when nothing changed, and an emptied project is dropped. */
  private async updateProject(
    projectId: string,
    token: string,
    bucket: string,
    update: (versions: ProjectVersions) => ProjectVersions,
  ): Promise<void> {
    const viewed = await this.readViewed(token, bucket);
    const key =
      findProjectKey(viewed.projectConversationIds, projectId) ??
      safeDecodeURIComponent(projectId);
    const current = viewed.projectConversationIds[key] ?? {};
    const next = update(current);
    if (sameVersions(current, next)) return;
    const rest = omitKey(viewed.projectConversationIds, key);
    await this.writeViewed(
      {
        ...viewed,
        projectConversationIds:
          Object.keys(next).length > 0 ? { ...rest, [key]: next } : rest,
      },
      token,
      bucket,
    );
  }

  private includes(viewed: ViewedConversations, conversationId: string) {
    const target = safeDecodeURIComponent(conversationId);
    return viewed.conversationIds.some(
      (id) => safeDecodeURIComponent(id) === target,
    );
  }

  /** The stored baseline, a freshly created one when the file is missing, or `null` when it is malformed. */
  private async resolveBaseline(
    result: ClientDataReadResult,
    token: string,
    bucket: string,
  ): Promise<number | null> {
    if (result.kind === ClientDataReadKind.Ok) {
      return parseConversationsReadBaseline(result.value);
    }
    if (result.kind === ClientDataReadKind.Malformed) return null;

    const baseline: ConversationsReadBaseline = {
      version: 1,
      readBefore: Date.now(),
    };
    await this.file.write(READ_BASELINE_PATH, baseline, token, bucket);
    return baseline.readBefore;
  }

  private async readViewed(
    token: string,
    bucket: string,
  ): Promise<ViewedConversations> {
    const result = await this.file.read(
      VIEWED_CONVERSATIONS_PATH,
      token,
      bucket,
    );
    return result.kind === ClientDataReadKind.Ok
      ? parseViewedConversations(result.value)
      : { ...DEFAULT_VIEWED_CONVERSATIONS, projectConversationIds: {} };
  }

  private writeViewed(
    viewed: ViewedConversations,
    token: string,
    bucket: string,
  ): Promise<void> {
    return this.file.write(VIEWED_CONVERSATIONS_PATH, viewed, token, bucket);
  }
}
