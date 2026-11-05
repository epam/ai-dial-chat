import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConversationService } from '../../conversations/conversation.service';
import type { CreateConversationDto } from '../../conversations/dto/create-conversation.dto';
import type { RenameConversationResponseDto } from '../../conversations/dto/rename-conversation.dto';
import { ProjectConversationStore } from '../../conversations/persistence/project-conversation.store';
import { buildNewConversation } from '../../conversations/utils/conversation.utils';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  ConversationReadStateService,
  isProjectConversationUnread,
} from '../../scheduled-task-unread/conversation-read-state.service';
import { ProjectAccessService } from '../access/project-access.service';
import {
  buildProjectConversationLocator,
  fromStrippedProjectConversationPath,
  toProjectConversationDeploymentKey,
} from '../utils/project-conversation-id.util';
import type { ParsedProjectId } from '../utils/project-id.util';
import type { ProjectConversationListResponseDto } from './dto/project-conversation-list-response.dto';
import type { ProjectConversationTitlesResponseDto } from './dto/project-conversation-titles.dto';
import { ProjectConversationsListService } from './project-conversations-list.service';

/**
 * Conversations stored inside a project. Every operation addresses the
 * conversation by its locator, so the regular conversation services (and
 * through `ConversationPersistenceService` the project store) do the work.
 * Writes need `canEdit` (`ProjectAccessService.assertCanWrite`): the owner,
 * or a recipient the project is shared with with `WRITE`, who may then write
 * every conversation of the project. A refused write makes no conversation
 * write. Each write evicts the listing's cached title.
 */
@Injectable()
export class ProjectConversationsService {
  private readonly logger = new Logger(ProjectConversationsService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly store: ProjectConversationStore,
    private readonly listService: ProjectConversationsListService,
    private readonly readStateService: ConversationReadStateService,
    private readonly accessService: ProjectAccessService,
  ) {}

  /**
   * The locator of a completion, stop or attach body `path` (the locator
   * without `projects/`), which must name a conversation of `project`.
   */
  resolveCompletionLocator(project: ParsedProjectId, path: string): string {
    const parsed = fromStrippedProjectConversationPath(path);
    if (parsed == null || parsed.project.id !== project.id) {
      throw new BadRequestException(
        'path must name a conversation of the addressed project',
      );
    }
    return parsed.locator;
  }

  listConversations(
    project: ParsedProjectId,
    accessToken: string,
    sessionBucket: string,
  ): Promise<ProjectConversationListResponseDto> {
    return this.listService.listProjectConversations(
      project,
      accessToken,
      sessionBucket,
    );
  }

  /** Resolves the titles and read state of the named conversations; names the project does not hold are omitted. */
  resolveConversations(
    project: ParsedProjectId,
    names: string[],
    accessToken: string,
    sessionBucket: string,
  ): Promise<ProjectConversationTitlesResponseDto> {
    return this.listService.resolveProjectConversations(
      project,
      names,
      accessToken,
      sessionBucket,
    );
  }

  /**
   * Records the conversation's current version as seen by the caller, in the
   * caller's own read state. Any reader may call it: reading the body checks
   * Core access and proves the conversation exists.
   */
  async markViewed(
    project: ParsedProjectId,
    name: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<void> {
    const locator = buildProjectConversationLocator(project, name);
    const stored = await this.store.readConversationWithEtag(
      locator,
      accessToken,
    );
    if (stored == null) {
      throw new NotFoundException('Conversation not found');
    }
    /* The project store always answers a content hash; without one there is nothing to compare later. */
    if (stored.etag == null) return;
    await this.readStateService.markProjectConversationViewed(
      project.id,
      locator,
      stored.etag,
      accessToken,
      sessionBucket,
    );
    this.logger.debug('Project conversation marked viewed');
  }

  /** Creates `conversations/{deployment}__{title}__{uuid}` with `If-Match: *`; the trailing UUID makes a collision negligible. */
  async createConversation(
    project: ParsedProjectId,
    dto: CreateConversationDto,
    accessToken: string,
    sessionBucket: string,
  ): Promise<ConversationResponseDto> {
    await this.accessService.assertCanWrite(
      project,
      sessionBucket,
      accessToken,
    );
    const { conversation } = buildNewConversation({
      firstMessage: dto.firstMessage,
      deploymentId: dto.deploymentId,
      fileDeploymentKey: toProjectConversationDeploymentKey(dto.deploymentId),
      customContent: dto.custom_content,
      folderId: project.id,
      toId: (fileName) => buildProjectConversationLocator(project, fileName),
    });
    const saved = await this.store.saveConversation(
      conversation.id,
      accessToken,
      conversation,
    );
    this.logger.log('Project conversation created');
    return saved;
  }

  getConversation(
    project: ParsedProjectId,
    name: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<ConversationResponseDto> {
    return this.conversationService.getConversation(
      buildProjectConversationLocator(project, name),
      accessToken,
      sessionBucket,
    );
  }

  /** Saves a client body; a pending background message is never overwritten, as for `PUT /api/v1/conversations`. */
  async saveConversation(
    project: ParsedProjectId,
    name: string,
    conversation: ConversationResponseDto,
    accessToken: string,
    sessionBucket: string,
  ): Promise<ConversationResponseDto> {
    await this.accessService.assertCanWrite(
      project,
      sessionBucket,
      accessToken,
    );
    const locator = buildProjectConversationLocator(project, name);
    const saved = await this.conversationService.saveClientConversation(
      locator,
      accessToken,
      sessionBucket,
      conversation,
    );
    await this.listService.evict(locator);
    return saved;
  }

  /** Rewrites the body's `name` at the same file name: Core cannot move a file inside a project. */
  async renameConversation(
    project: ParsedProjectId,
    name: string,
    newTitle: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<RenameConversationResponseDto> {
    await this.accessService.assertCanWrite(
      project,
      sessionBucket,
      accessToken,
    );
    const locator = buildProjectConversationLocator(project, name);
    const wasRead = await this.isReadQuietly(
      project,
      locator,
      accessToken,
      sessionBucket,
    );
    const renamed = await this.conversationService.renameConversation(
      locator,
      newTitle,
      accessToken,
      sessionBucket,
    );
    await this.listService.evict(locator);
    if (wasRead) {
      await this.keepReadQuietly(project, locator, accessToken, sessionBucket);
    }
    return renamed;
  }

  async deleteConversation(
    project: ParsedProjectId,
    name: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<void> {
    await this.accessService.assertCanWrite(
      project,
      sessionBucket,
      accessToken,
    );
    const locator = buildProjectConversationLocator(project, name);
    await this.store.deleteConversation(locator, accessToken);
    await this.listService.evict(locator);
    this.logger.log('Project conversation deleted');
    try {
      await this.readStateService.removeProjectConversation(
        project.id,
        locator,
        accessToken,
        sessionBucket,
      );
    } catch {
      this.logger.warn(
        'Failed to drop the deleted project conversation from the read state',
      );
    }
  }

  /*
   * A rename rewrites the body, so its version changes and the renamer's own
   * read chat would turn unread. Whether it was read is decided before the
   * write; any failure answers false, so a rename is never blocked.
   */
  private async isReadQuietly(
    project: ParsedProjectId,
    locator: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<boolean> {
    try {
      const [state, stored] = await Promise.all([
        this.readStateService.getProjectReadState(
          project.id,
          accessToken,
          sessionBucket,
        ),
        this.store.readConversationWithEtag(locator, accessToken),
      ]);
      if (state == null || stored?.etag == null) return false;
      /* Viewed at this version, or untouched since the baseline; an unknown time is not read. */
      const updatedAt = stored.conversation.updatedAt;
      return (
        state.versions.get(locator) === stored.etag ||
        (typeof updatedAt === 'number' &&
          !isProjectConversationUnread(state, locator, updatedAt, stored.etag))
      );
    } catch {
      this.logger.warn('Failed to read the read state before rename');
      return false;
    }
  }

  private async keepReadQuietly(
    project: ParsedProjectId,
    locator: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<void> {
    try {
      const stored = await this.store.readConversationWithEtag(
        locator,
        accessToken,
      );
      if (stored?.etag == null) return;
      await this.readStateService.markProjectConversationViewed(
        project.id,
        locator,
        stored.etag,
        accessToken,
        sessionBucket,
      );
    } catch {
      this.logger.warn('Failed to keep the renamed project conversation read');
    }
  }
}
