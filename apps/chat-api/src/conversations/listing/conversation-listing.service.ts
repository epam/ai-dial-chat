import { Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { HIDDEN_FILE } from '../../constants/dial.constants';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationMetadataDto } from '../../openapi/openapi-response.dto';
import { ScheduledTaskUnreadService } from '../../scheduled-task-unread/scheduled-task-unread.service';
import { UserConfigService } from '../../user-config/user-config.service';
import {
  MAX_LIST_DISPLAY_NAME_ENRICHMENTS,
  PUBLIC_BUCKET,
} from '../constants/conversation.constants';
import {
  ConversationListItemDto,
  ConversationListResponseDto,
} from '../dto/conversation-list.dto';
import { ConversationPersistenceService } from '../persistence/conversation-persistence.service';
import type {
  MetadataItem,
  MetadataResult,
  SharedResourcesResult,
} from '../types/conversation.types';
import {
  decodeNextToken,
  encodeCompoundToken,
  getConversationTitleFromName,
  qualifySessionConversationPath,
  resolveListDisplayTitle,
} from '../utils/conversation.utils';
import { parseScheduledTaskConversationPath } from '../utils/parse-scheduled-task-conversation-path';

@Injectable()
export class ConversationListingService {
  private readonly logger = new Logger(ConversationListingService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly userConfigService: UserConfigService,
    private readonly scheduledTaskUnreadService: ScheduledTaskUnreadService,
    private readonly persistenceService: ConversationPersistenceService,
  ) {}

  async listConversations(
    token: string,
    bucket: string,
    limit = 100,
    nextToken?: string,
  ): Promise<ConversationListResponseDto> {
    const { u: userNextToken, p: publicNextToken } = decodeNextToken(nextToken);

    const buildQuery = (cursor?: string) => ({
      recursive: true as const,
      limit,
      ...(cursor ? { token: cursor } : {}),
    });

    try {
      const [userResult, publicResult, sharedResult, pinnedIds, viewedIds] =
        await Promise.all([
          this.dialClient.client.getConversationMetadata(bucket, '', {
            headers: getBearerAuthHeaders(token),
            params: {
              query: { ...buildQuery(userNextToken), permissions: true },
            },
          }) as Promise<MetadataResult & { response: globalThis.Response }>,
          (
            this.dialClient.client.getConversationMetadata(PUBLIC_BUCKET, '', {
              headers: getBearerAuthHeaders(token),
              params: { query: buildQuery(publicNextToken) },
            }) as Promise<MetadataResult>
          ).catch((err: unknown) => {
            this.logger.warn(
              'DIAL Core listConversations (public bucket) failed',
              err,
            );
            return { data: undefined, error: err } satisfies MetadataResult;
          }),
          (
            this.dialClient.client.getSharedResources({
              headers: getBearerAuthHeaders(token),
              body: { resourceTypes: ['CONVERSATION'], with: 'me' },
            }) as Promise<SharedResourcesResult>
          ).catch((err: unknown) => {
            this.logger.warn(
              'DIAL Core listConversations (shared resources) failed',
              err,
            );
            return {
              data: undefined,
              error: err,
            } satisfies SharedResourcesResult;
          }),
          this.userConfigService.getPinnedIds(token, bucket),
          this.scheduledTaskUnreadService.getViewedIds(token, bucket),
        ]);

      const {
        data: userData,
        error: userError,
        response: userResponse,
      } = userResult;

      if (userError !== undefined || !userData) {
        this.logger.error(
          'DIAL Core rejected listConversations (user bucket)',
          userError,
        );
        return handleDialSdkError(
          userError,
          'conversations.listConversations',
          this.logger,
          userResponse,
        );
      }

      const resolvedUserData: { items?: MetadataItem[]; nextToken?: string } =
        userData;

      const { data: publicData, error: publicError } = publicResult;
      if (publicError !== undefined) {
        this.logger.warn(
          'DIAL Core rejected listConversations (public bucket)',
          publicError,
        );
      }

      const { data: sharedData, error: sharedError } = sharedResult;
      if (sharedError !== undefined) {
        this.logger.warn(
          'DIAL Core listConversations (shared resources) failed',
          sharedError,
        );
      }

      const pinnedSet = new Set(pinnedIds.map(safeDecodeURIComponent));
      const viewedSet = new Set(viewedIds.map(safeDecodeURIComponent));

      const mapItems = (
        items: MetadataItem[],
        overrides: {
          sharedWithMe?: boolean;
          publishedWithMe?: boolean;
          isReadonly?: boolean;
        } = {},
      ): ConversationListItemDto[] =>
        items
          .filter((item) => item.nodeType !== 'FOLDER')
          .map((item) => {
            const id =
              item.url ?? `${item.parentPath ?? ''}/${item.name ?? ''}`;
            const decodedId = safeDecodeURIComponent(id);
            const isReadonly =
              overrides.isReadonly ??
              !(item.permissions?.includes('WRITE') ?? false);
            const scheduledTask = parseScheduledTaskConversationPath(id);
            return {
              id,
              title: getConversationTitleFromName(item.name ?? ''),
              updatedAt: item.updatedAt ?? 0,
              sharedWithMe:
                overrides.sharedWithMe ?? item.sharedWithMe ?? false,
              publishedWithMe:
                overrides.publishedWithMe ?? item.publishedWithMe ?? false,
              isPinned: pinnedSet.has(decodedId),
              isReadonly,
              isScheduledTask: scheduledTask !== null,
              ...(scheduledTask !== null
                ? {
                    scheduleId: scheduledTask.scheduleId,
                    runId: scheduledTask.runId,
                    isUnread: !viewedSet.has(decodedId),
                  }
                : {}),
            };
          });

      /*
       * The user's personal-bucket copy and its public-bucket copy (if the
       * conversation has been published) are always returned as two
       * independent list items, each with its own resource id — a personal,
       * writable entry and a separate, read-only public entry. They are
       * intentionally not merged/deduplicated: matching them by relative
       * path is unreliable (publish lets the user pick an arbitrary target
       * folder, so the public path rarely mirrors the personal one), and
       * merging previously caused the personal copy's pin state to be lost
       * and any link built from the merged item to point at the wrong
       * bucket. Keeping both means every link/pin/permission stays scoped
       * to the bucket it actually belongs to.
       */
      const userItems = mapItems(resolvedUserData.items ?? []);

      const publicItems =
        publicError == null && publicData
          ? mapItems(publicData.items ?? [], {
              publishedWithMe: true,
              isReadonly: true,
            })
          : [];
      const sharedItems =
        sharedError == null && sharedData
          ? (sharedData.resources ?? [])
              .filter((r) => r.nodeType !== 'FOLDER')
              .map((r) => {
                const id = r.url ?? `${r.parentPath ?? ''}/${r.name ?? ''}`;
                const decodedId = safeDecodeURIComponent(id);
                const scheduledTask = parseScheduledTaskConversationPath(id);
                return {
                  id,
                  title: getConversationTitleFromName(r.name ?? ''),
                  updatedAt: 0,
                  sharedWithMe: true,
                  publishedWithMe: false,
                  isPinned: pinnedSet.has(decodedId),
                  isReadonly: true,
                  isScheduledTask: scheduledTask !== null,
                  ...(scheduledTask !== null
                    ? {
                        scheduleId: scheduledTask.scheduleId,
                        runId: scheduledTask.runId,
                        isUnread: !viewedSet.has(decodedId),
                      }
                    : {}),
                };
              })
          : [];

      const items = await this.enrichListItemsWithStoredDisplayNames(
        [...userItems, ...publicItems, ...sharedItems]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .filter(
            (item) => item.id !== HIDDEN_FILE && !item.id.includes(HIDDEN_FILE),
          ),
        token,
        bucket,
      );

      return {
        items,
        nextToken: encodeCompoundToken(
          resolvedUserData.nextToken,
          publicData?.nextToken,
        ),
      };
    } catch (error) {
      this.logger.error('DIAL Core listConversations failed', error);
      return handleDialSdkError(
        error,
        'conversations.listConversations',
        this.logger,
      );
    }
  }

  async getConversationMetadata(
    conversationPath: string,
    token: string,
    bucket: string,
    permissions?: boolean,
  ): Promise<ConversationMetadataDto> {
    try {
      const { data, error, response } =
        await this.dialClient.client.getConversationMetadata(
          bucket,
          encodeDialResourcePath(conversationPath),
          {
            headers: getBearerAuthHeaders(token),
            params:
              permissions !== undefined
                ? { query: { permissions } }
                : undefined,
          },
        );
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected getConversationMetadata', error);
        return handleDialSdkError(
          error,
          'conversations.getConversationMetadata',
          this.logger,
          response,
        );
      }
      return data as ConversationMetadataDto;
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversationMetadata', error);
      return handleDialSdkError(
        error,
        'conversations.getConversationMetadata',
        this.logger,
      );
    }
  }

  private getListItemRelativePath(itemId: string): string {
    const decodedId = safeDecodeURIComponent(itemId);
    const parts = decodedId.split('/');
    if (parts.length >= 3 && parts[0] === 'conversations') {
      return parts.slice(2).join('/');
    }
    if (parts.length >= 2) {
      return parts.slice(1).join('/');
    }
    return decodedId;
  }

  private async enrichListItemsWithStoredDisplayNames(
    items: ConversationListItemDto[],
    token: string,
    bucket: string,
  ): Promise<ConversationListItemDto[]> {
    const enrichable = items.filter(
      (item) => !item.isReadonly && !item.sharedWithMe && !item.publishedWithMe,
    );
    if (enrichable.length === 0) {
      return items;
    }

    const candidates = [...enrichable]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_LIST_DISPLAY_NAME_ENRICHMENTS);

    const displayNameById = new Map<string, string>();
    const batchSize = 25;

    for (let index = 0; index < candidates.length; index += batchSize) {
      const batch = candidates.slice(index, index + batchSize);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const conversation =
              await this.persistenceService.getStoredConversation(
                qualifySessionConversationPath(
                  this.getListItemRelativePath(item.id),
                  bucket,
                ),
                token,
                bucket,
              );
            const displayName = resolveListDisplayTitle(
              item.title,
              conversation.conversation,
            );
            if (displayName) {
              displayNameById.set(item.id, displayName);
            }
          } catch {
            // Keep the filename-derived title when the body cannot be read.
          }
        }),
      );
    }

    return items.map((item) => {
      const displayName = displayNameById.get(item.id);
      return displayName ? { ...item, title: displayName } : item;
    });
  }
}
