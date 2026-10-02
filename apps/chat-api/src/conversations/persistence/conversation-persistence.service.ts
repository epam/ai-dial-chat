import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { handleDialSdkError } from '../../common/dial/dial-error.mapper';
import { getBearerAuthHeaders } from '../../common/utils/auth-header';
import { buildIfMatchHeaders } from '../../common/utils/conditional-headers';
import { encodeDialResourcePath } from '../../common/utils/encode-dial-path';
import { safeDecodeURIComponent } from '../../common/utils/uri';
import { DialClientService } from '../../dial/dial-client.service';
import { ConversationResponseDto } from '../../openapi/openapi-response.dto';
import { ConversationNamingService } from '../conversation-naming.service';
import {
  CONDITIONAL_WRITE_ATTEMPTS,
  ConditionalUpdateStatus,
  type ConditionalSaveResult,
  type ConditionalUpdateResult,
  type ConversationPersistencePort,
  type VersionedConversation,
} from '../conversation-persistence.port';
import {
  getConversationTitleFromName,
  isApplicationDeploymentPath,
  qualifySessionConversationPath,
  resolveConversationLocation,
  resolveListDisplayTitle,
} from '../utils/conversation.utils';

/**
 * Keeps the display title LLM naming already stored: a client body without
 * `llmNamingDone` takes the stored `name` when storage has one.
 * @param conversation - body about to be saved
 * @param stored - the conversation currently in storage
 */
export const withStoredLlmDisplayName = (
  conversation: ConversationResponseDto,
  stored: ConversationResponseDto | undefined,
): ConversationResponseDto =>
  conversation.llmNamingDone !== true &&
  stored?.llmNamingDone === true &&
  stored.name?.trim()
    ? { ...conversation, name: stored.name, llmNamingDone: true }
    : conversation;

/**
 * Applies `update` to the latest stored version and saves the result with `If-Match`,
 * re-reading and re-applying on a concurrent change (`412`) up to
 * {@link CONDITIONAL_WRITE_ATTEMPTS} times. `update` receives `null` for a missing
 * conversation and returns the body to save, or `null` to skip the write. A version
 * read without an `ETag` is saved unconditionally; callers that must not write
 * unfenced check `stored.etag` themselves.
 * @param io - the read and write operations to use
 * @param conversationPath - conversation path relative to `bucket`
 * @param token - caller's bearer token
 * @param bucket - caller's session bucket
 * @param update - builds the body to save from the stored version
 * @param initial - a version the caller already read, used for the first attempt
 */
export const runConditionalUpdate = async (
  io: Pick<
    ConversationPersistencePort,
    'readConversationWithEtag' | 'saveConversationIfMatch' | 'saveConversation'
  >,
  conversationPath: string,
  token: string,
  bucket: string,
  update: (
    stored: VersionedConversation | null,
  ) => ConversationResponseDto | null,
  initial?: VersionedConversation,
): Promise<ConditionalUpdateResult> => {
  for (let attempt = 0; attempt < CONDITIONAL_WRITE_ATTEMPTS; attempt++) {
    const stored =
      attempt === 0 && initial
        ? initial
        : await io.readConversationWithEtag(conversationPath, token, bucket);
    const body = update(stored);
    if (!body) return { status: ConditionalUpdateStatus.Skipped };
    if (!stored?.etag) {
      return {
        status: ConditionalUpdateStatus.Saved,
        conversation: await io.saveConversation(
          conversationPath,
          token,
          bucket,
          body,
        ),
      };
    }
    const saved = await io.saveConversationIfMatch(
      conversationPath,
      token,
      bucket,
      body,
      stored.etag,
    );
    if (saved.isSaved) {
      return {
        status: ConditionalUpdateStatus.Saved,
        conversation: saved.conversation,
      };
    }
  }
  return { status: ConditionalUpdateStatus.Conflict };
};

@Injectable()
export class ConversationPersistenceService implements ConversationPersistencePort {
  private readonly logger = new Logger(ConversationPersistenceService.name);

  constructor(
    private readonly dialClient: DialClientService,
    @Inject(forwardRef(() => ConversationNamingService))
    private readonly conversationNamingService: ConversationNamingService,
  ) {}

  async getConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<ConversationResponseDto> {
    const { conversation } = await this.getConversationWithStoredVersion(
      conversationPath,
      token,
      sessionBucket,
    );
    return conversation;
  }

  /**
   * Reads the conversation like {@link getConversation} and also returns the stored
   * version it was derived from, so the caller can write conditionally without a second
   * read.
   * @param conversationPath - conversation path, qualified or relative to the bucket
   * @param token - caller's bearer token
   * @param sessionBucket - caller's session bucket
   */
  async getConversationWithStoredVersion(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<{
    conversation: ConversationResponseDto;
    stored: VersionedConversation;
  }> {
    try {
      const {
        conversation: storedConversation,
        subPath,
        etag,
      } = await this.getStoredConversation(
        conversationPath,
        token,
        sessionBucket,
      );
      const subPathSegments = subPath.split('/');
      const filename = subPathSegments.pop() ?? subPath;
      const pathTitle = getConversationTitleFromName(
        safeDecodeURIComponent(filename),
        isApplicationDeploymentPath(subPathSegments.join('/')),
      );
      const resolvedName = resolveListDisplayTitle(
        pathTitle,
        storedConversation,
      );
      return {
        conversation:
          resolvedName === storedConversation.name
            ? storedConversation
            : { ...storedConversation, name: resolvedName },
        stored: { conversation: storedConversation, etag },
      };
    } catch (error) {
      this.logger.error('DIAL Core rejected getConversation', error);
      return handleDialSdkError(
        error,
        'conversations.getConversation',
        this.logger,
      );
    }
  }

  async getStoredConversation(
    conversationPath: string,
    token: string,
    sessionBucket: string,
  ): Promise<{
    conversation: ConversationResponseDto;
    subPath: string;
    etag: string | null;
  }> {
    const { bucket, subPath } = resolveConversationLocation(
      conversationPath,
      sessionBucket,
    );

    const { data, error, response } =
      (await this.dialClient.client.getConversation(
        bucket,
        encodeDialResourcePath(subPath),
        { headers: getBearerAuthHeaders(token) },
      )) as {
        data?: unknown;
        error?: unknown;
        response: globalThis.Response;
      };
    if (error != null || !data) {
      this.logger.debug(
        `getStoredConversation rejected — bucket: ${bucket}, subPath: ${subPath}, status: ${response.status}, error: ${JSON.stringify(error)}`,
      );
      handleDialSdkError(
        error,
        'conversations.getStoredConversation',
        this.logger,
        response,
      );
    }

    return {
      conversation: data as ConversationResponseDto,
      subPath,
      etag: response?.headers?.get('etag') ?? null,
    };
  }

  async saveConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    const bodyToSave = await this.preserveLlmDisplayName(
      conversationPath,
      token,
      bucket,
      conversation,
    );

    try {
      const { data, error, response } =
        await this.dialClient.client.saveConversation(
          bucket,
          encodeDialResourcePath(conversationPath),
          {
            headers: getBearerAuthHeaders(token),
            body: bodyToSave as never,
          },
        );
      if (error != null || !data) {
        this.logger.error('DIAL Core rejected saveConversation', error);
        return handleDialSdkError(
          error,
          'conversations.saveConversation',
          this.logger,
          response,
        );
      }
      const saved = { ...data, ...bodyToSave } as ConversationResponseDto;
      if (saved.llmNamingDone !== true) {
        this.conversationNamingService.maybeRenameAfterFirstReply(
          conversationPath,
          token,
          bucket,
          saved,
        );
      }
      return saved;
    } catch (error) {
      this.logger.error('DIAL Core rejected saveConversation', error);
      return handleDialSdkError(
        error,
        'conversations.saveConversation',
        this.logger,
      );
    }
  }

  /**
   * Reads the stored conversation together with its DIAL Core `ETag`, for writers that
   * must not overwrite a newer version. Resolves `null` on `404`.
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - caller's bearer token
   * @param bucket - caller's session bucket
   */
  async readConversationWithEtag(
    conversationPath: string,
    token: string,
    bucket: string,
  ): Promise<VersionedConversation | null> {
    const { bucket: resolvedBucket, subPath } = resolveConversationLocation(
      qualifySessionConversationPath(conversationPath, bucket),
      bucket,
    );
    const { data, error, response } =
      (await this.dialClient.client.getConversation(
        resolvedBucket,
        encodeDialResourcePath(subPath),
        { headers: getBearerAuthHeaders(token) },
      )) as {
        data?: unknown;
        error?: unknown;
        response: globalThis.Response;
      };
    if (response.status === 404) return null;
    if (error != null || !data) {
      return handleDialSdkError(
        error,
        'conversations.readConversationWithEtag',
        this.logger,
        response,
      );
    }
    return {
      conversation: data as ConversationResponseDto,
      etag: response.headers.get('etag'),
    };
  }

  /**
   * Saves the conversation with `If-Match`, so it is written only while storage still
   * holds the version identified by `etag`. Schedules LLM naming like `saveConversation`.
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - caller's bearer token
   * @param bucket - caller's session bucket
   * @param conversation - full conversation body to write
   * @param etag - `ETag` of the version the body was derived from
   */
  async saveConversationIfMatch(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
    etag: string,
  ): Promise<ConditionalSaveResult> {
    const { bucket: resolvedBucket, subPath } = resolveConversationLocation(
      qualifySessionConversationPath(conversationPath, bucket),
      bucket,
    );
    const { data, error, response } =
      await this.dialClient.client.saveConversation(
        resolvedBucket,
        encodeDialResourcePath(subPath),
        {
          headers: {
            ...getBearerAuthHeaders(token),
            ...buildIfMatchHeaders(etag),
          },
          body: conversation as never,
        },
      );
    if (response?.status === 412) return { isSaved: false };
    if (error != null || !data) {
      return handleDialSdkError(
        error,
        'conversations.saveConversationIfMatch',
        this.logger,
        response,
      );
    }
    const saved = { ...data, ...conversation } as ConversationResponseDto;
    if (saved.llmNamingDone !== true) {
      this.conversationNamingService.maybeRenameAfterFirstReply(
        conversationPath,
        token,
        bucket,
        saved,
      );
    }
    return { isSaved: true, conversation: saved };
  }

  /**
   * Applies `update` to the latest stored version and saves it conditionally; see
   * {@link runConditionalUpdate}.
   * @param conversationPath - conversation path relative to `bucket`
   * @param token - caller's bearer token
   * @param bucket - caller's session bucket
   * @param update - builds the body to save from the stored version
   * @param initial - a version the caller already read, used for the first attempt
   */
  updateConversation(
    conversationPath: string,
    token: string,
    bucket: string,
    update: (
      stored: VersionedConversation | null,
    ) => ConversationResponseDto | null,
    initial?: VersionedConversation,
  ): Promise<ConditionalUpdateResult> {
    return runConditionalUpdate(
      this,
      conversationPath,
      token,
      bucket,
      update,
      initial,
    );
  }

  /**
   * Client saves often carry a stale message-derived `name`. Once LLM naming has
   * persisted a display title, later saves must not overwrite it.
   */
  private async preserveLlmDisplayName(
    conversationPath: string,
    token: string,
    bucket: string,
    conversation: ConversationResponseDto,
  ): Promise<ConversationResponseDto> {
    if (conversation.llmNamingDone === true) {
      return conversation;
    }

    try {
      const { conversation: existing } = await this.getStoredConversation(
        qualifySessionConversationPath(conversationPath, bucket),
        token,
        bucket,
      );
      return withStoredLlmDisplayName(conversation, existing);
    } catch {
      // New conversations or transient read failures keep the incoming body.
    }

    return conversation;
  }
}
