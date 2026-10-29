import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { PUBLIC_BUCKET, HIDDEN_FILE } from '../../constants/dial.constants';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationMetadataDto } from '../../openapi/openapi-response.dto';
import {
  ConversationReadStateService,
  isRegularConversationUnread,
} from '../../scheduled-task-unread/conversation-read-state.service';
import { ScheduledTaskUnreadService } from '../../scheduled-task-unread/scheduled-task-unread.service';
import { UserConfigService } from '../../user-config/user-config.service';
import {
  ConversationListItemDto,
  ConversationListResponseDto,
} from '../dto/conversation-list.dto';
import type {
  MetadataItem,
  MetadataResult,
  ShareGrant,
  SharedResourcesResult,
} from '../types/conversation.types';
import {
  decodeNextToken,
  encodeCompoundToken,
  getConversationTitleFromName,
  isApplicationDeploymentPath,
  resolveListDisplayTitle,
} from '../utils/conversation.utils';
import { parseScheduledTaskConversationPath } from '../utils/parse-scheduled-task-conversation-path';
import { ConversationTitleCacheService } from './conversation-title-cache.service';
import { ConversationTitlesService } from './conversation-titles.service';

const FULL_CONVERSATION_LIST_PAGE_LIMIT = 1000;

/** Latest time the current user accepted a share of this resource, or 0. */
const getSharedAt = (sharedBy: ShareGrant[] | undefined): number =>
  (sharedBy ?? []).reduce(
    (latest, { acceptedAt }) =>
      acceptedAt != null && Number.isFinite(acceptedAt)
        ? Math.max(latest, acceptedAt)
        : latest,
    0,
  );

@Injectable()
export class ConversationListingService {
  private readonly logger = new Logger(ConversationListingService.name);

  constructor(
    private readonly dialClient: DialClientService,
    private readonly userConfigService: UserConfigService,
    private readonly scheduledTaskUnreadService: ScheduledTaskUnreadService,
    private readonly titleCache: ConversationTitleCacheService,
    private readonly titlesService: ConversationTitlesService,
    private readonly conversationReadStateService: ConversationReadStateService,
  ) {}

  private async listBucketMetadata(
    token: string,
    bucket: string,
    limit: number,
    cursor: string | undefined,
    aggregateAllPages: boolean,
    permissions?: boolean,
  ): Promise<MetadataResult> {
    const items: MetadataItem[] = [];
    const seenCursors = new Set<string>();
    let result: MetadataResult;

    do {
      result = (await this.dialClient.client.getConversationMetadata(
        bucket,
        '',
        {
          headers: getBearerAuthHeaders(token),
          params: {
            query: {
              recursive: true,
              limit,
              ...(cursor ? { token: cursor } : {}),
              ...(permissions != null ? { permissions } : {}),
            },
          },
        },
      )) as MetadataResult;

      if (!aggregateAllPages || result.error != null || !result.data) {
        return result;
      }

      items.push(...(result.data.items ?? []));
      cursor = result.data.nextToken;
      if (cursor && seenCursors.has(cursor)) {
        throw new BadGatewayException(
          'DIAL Core repeated a conversation listing cursor',
        );
      }
      if (cursor) seenCursors.add(cursor);
    } while (cursor);

    return { data: { items }, response: result.response };
  }

  async listConversations(
    token: string,
    bucket: string,
    limit?: number,
    nextToken?: string,
  ): Promise<ConversationListResponseDto> {
    const { u: userNextToken, p: publicNextToken } = decodeNextToken(nextToken);

    /* Match file listing: omitted pagination requests the complete history. */
    const aggregateAllPages = limit == null && nextToken == null;
    const pageLimit = aggregateAllPages
      ? FULL_CONVERSATION_LIST_PAGE_LIMIT
      : (limit ?? 100);

    try {
      const [
        userResult,
        publicResult,
        sharedResult,
        pinnedIds,
        viewedIds,
        readState,
      ] = await Promise.all([
        this.listBucketMetadata(
          token,
          bucket,
          pageLimit,
          userNextToken,
          aggregateAllPages,
          true,
        ),
        this.listBucketMetadata(
          token,
          PUBLIC_BUCKET,
          pageLimit,
          publicNextToken,
          aggregateAllPages,
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
        this.conversationReadStateService.getReadState(token, bucket),
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
          /* Only the caller's own bucket holds their scheduled-task runs. */
          isOwnBucket?: boolean;
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
            const scheduledTask = overrides.isOwnBucket
              ? parseScheduledTaskConversationPath(id)
              : null;
            return {
              id,
              title: getConversationTitleFromName(
                item.name ?? '',
                isApplicationDeploymentPath(item.parentPath),
              ),
              ...(Number.isFinite(item.createdAt)
                ? { createdAt: item.createdAt }
                : {}),
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
                : overrides.isOwnBucket &&
                    readState &&
                    isRegularConversationUnread(
                      readState,
                      id,
                      item.updatedAt ?? 0,
                    )
                  ? { isUnread: true }
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
       *
       * A published or shared copy of a scheduled-task run is an ordinary
       * conversation for its recipient: they cannot open the task, and the
       * viewed-ids file in their bucket is keyed by their own bucket, so an
       * unread mark on the copy could never be cleared (#9501).
       */
      const userItems = mapItems(resolvedUserData.items ?? [], {
        isOwnBucket: true,
      });

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
              .map((r) => ({ resource: r, sharedAt: getSharedAt(r.sharedBy) }))
              /*
               * Shared items carry no `updatedAt`, so they all tie at 0 in the
               * stable merged sort below and this pre-sort alone decides the
               * Shared group's order: most recently shared first, then by
               * name and url so the order is deterministic across reloads
               * whatever order DIAL Core returns them in.
               */
              .sort(
                (left, right) =>
                  right.sharedAt - left.sharedAt ||
                  (left.resource.name ?? '').localeCompare(
                    right.resource.name ?? '',
                  ) ||
                  (left.resource.url ?? '').localeCompare(
                    right.resource.url ?? '',
                  ),
              )
              .map(({ resource: r }) => {
                const id = r.url ?? `${r.parentPath ?? ''}/${r.name ?? ''}`;
                const decodedId = safeDecodeURIComponent(id);
                return {
                  id,
                  title: getConversationTitleFromName(
                    r.name ?? '',
                    isApplicationDeploymentPath(r.parentPath),
                  ),
                  updatedAt: 0,
                  sharedWithMe: true,
                  publishedWithMe: false,
                  isPinned: pinnedSet.has(decodedId),
                  isReadonly: true,
                  isScheduledTask: false,
                };
              })
          : [];

      const items = this.withCachedDisplayNames(
        [...userItems, ...publicItems, ...sharedItems]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .filter(
            (item) => item.id !== HIDDEN_FILE && !item.id.includes(HIDDEN_FILE),
          ),
        token,
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

  getConversationTitles(ids: string[], token: string, signal?: AbortSignal) {
    return this.titlesService.getConversationTitles(ids, token, signal);
  }

  private withCachedDisplayNames(
    items: ConversationListItemDto[],
    token: string,
  ): ConversationListItemDto[] {
    return items.map((item) => {
      const summary = this.titleCache.get(token, item.id, item.updatedAt);
      return summary
        ? { ...item, title: resolveListDisplayTitle(item.title, summary) }
        : { ...item, isTitlePending: true };
    });
  }
}
