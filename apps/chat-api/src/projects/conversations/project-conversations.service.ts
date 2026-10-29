import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConversationService } from '../../conversations/conversation.service';
import type { CreateConversationDto } from '../../conversations/dto/create-conversation.dto';
import type { RenameConversationResponseDto } from '../../conversations/dto/rename-conversation.dto';
import { ProjectConversationStore } from '../../conversations/persistence/project-conversation.store';
import { buildNewConversation } from '../../conversations/utils/conversation.utils';
import type { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import {
  buildProjectConversationLocator,
  fromStrippedProjectConversationPath,
  toProjectConversationDeploymentKey,
} from '../utils/project-conversation-id.util';
import type { ParsedProjectId } from '../utils/project-id.util';
import type { ProjectConversationListResponseDto } from './dto/project-conversation-list-response.dto';
import { ProjectConversationsListService } from './project-conversations-list.service';

/**
 * Conversations stored inside a project. Every operation addresses the
 * conversation by its locator, so the regular conversation services (and
 * through `ConversationPersistenceService` the project store) do the work.
 * Writes are owner-only — the project bucket must be the session bucket,
 * matching `canEdit` — and are refused before any Core call. Each write
 * evicts the listing's cached title.
 */
@Injectable()
export class ProjectConversationsService {
  private readonly logger = new Logger(ProjectConversationsService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly store: ProjectConversationStore,
    private readonly listService: ProjectConversationsListService,
  ) {}

  /** `403` unless the project is in the caller's own bucket. */
  assertOwner(project: ParsedProjectId, sessionBucket: string): void {
    if (project.bucket !== sessionBucket) {
      throw new ForbiddenException(
        'Only the owner can write to a project conversation',
      );
    }
  }

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
    limit?: number,
  ): Promise<ProjectConversationListResponseDto> {
    return this.listService.listProjectConversations(
      project,
      accessToken,
      limit,
    );
  }

  /** Creates `conversations/{deployment}__{title}__{uuid}` with `If-Match: *`; the trailing UUID makes a collision negligible. */
  async createConversation(
    project: ParsedProjectId,
    dto: CreateConversationDto,
    accessToken: string,
    sessionBucket: string,
  ): Promise<ConversationResponseDto> {
    this.assertOwner(project, sessionBucket);
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
    this.assertOwner(project, sessionBucket);
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
    this.assertOwner(project, sessionBucket);
    const locator = buildProjectConversationLocator(project, name);
    const renamed = await this.conversationService.renameConversation(
      locator,
      newTitle,
      accessToken,
      sessionBucket,
    );
    await this.listService.evict(locator);
    return renamed;
  }

  async deleteConversation(
    project: ParsedProjectId,
    name: string,
    accessToken: string,
    sessionBucket: string,
  ): Promise<void> {
    this.assertOwner(project, sessionBucket);
    const locator = buildProjectConversationLocator(project, name);
    await this.store.deleteConversation(locator, accessToken);
    await this.listService.evict(locator);
    this.logger.log('Project conversation deleted');
  }
}
